import type { IncomingMessage, MessagingProvider } from '@/adapters/messaging';
import { env } from '@/config/env';
import {
	getChannelLinkSuccessMessage,
	getChannelNotRegisteredMessage,
	getChannelStartReturningMessage,
} from '@/config/prompts';
import { accountLinkingService } from '@/services/account-linking-service';
import { instrumentService } from '@/services/service-instrumentation';
import { userService } from '@/services/user-service';
import { loggers } from '@/utils/logger';

/**
 * Serviço centralizado para processar comandos do sistema (/start, /vincular, etc.)
 * Funciona de forma agnóstica ao provider.
 */
export class CommandHandlerService {
	/**
	 * Retorna o ID de identidade do remetente.
	 * Para Discord em guild: externalId = channelId (reply), userId = author.id (identidade).
	 * Para outros providers: externalId === userId, então userId ?? externalId sempre retorna o correto.
	 */
	private getIdentityId(message: IncomingMessage): string {
		return message.userId ?? message.externalId;
	}

	/**
	 * Tenta processar uma mensagem como um comando do sistema.
	 * Retorna true se a mensagem foi processada como comando, false caso contrário.
	 */
	async handleCommand(message: IncomingMessage, provider: MessagingProvider): Promise<boolean> {
		// 1. VERIFICA DEEP LINKING (TOKEN DE VINCULAÇÃO)
		if (message.linkingToken) {
			return await this.handleDeepLink(message, provider);
		}

		if (!message.text || !message.text.startsWith('/')) {
			return false;
		}

		const command = message.text.split(' ')[0].toLowerCase();
		loggers.webhook.info({ command, provider: message.provider }, '🤖 Processando comando de sistema');

		switch (command) {
			case '/vincular':
				return await this.handleLinkCommand(message, provider);
			case '/start':
				return await this.handleStartCommand(message, provider);
			default:
				return false;
		}
	}

	private async handleLinkCommand(message: IncomingMessage, provider: MessagingProvider): Promise<boolean> {
		const providerName = provider.getProviderName();
		const identityId = this.getIdentityId(message);

		// Verifica se já tem canal vinculado
		const existingAccount = await userService.findAccount(message.provider as any, identityId);
		if (existingAccount) {
			const token = await accountLinkingService.generateLinkingToken(existingAccount.userId, message.provider, 'link');
			await provider.sendMessage(
				message.externalId,
				`🔑 Seu código de vinculação é: **${token}**\n\nAcesse o seu painel e insira este código para unificar suas contas:\n\n🔗 ${env.DASHBOARD_URL}/profile`,
			);
			return true;
		}

		// Sem canal vinculado: tenta encontrar via OAuth (ex: Discord OAuth já conectado no Dashboard)
		const oauthUserId = await userService.findUserIdByOAuthAccount(providerName, identityId);
		if (oauthUserId) {
			await userService.linkAccountToUser(oauthUserId, message.provider as any, identityId, {
				username: message.senderName,
			});
			await provider.sendMessage(message.externalId, getChannelLinkSuccessMessage(providerName));
			return true;
		}

		// Sem OAuth: orienta a criar conta
		const signupLink = await this.buildPreSignupLink(identityId, message.provider, providerName);
		await provider.sendMessage(message.externalId, getChannelNotRegisteredMessage(providerName, signupLink));
		return true;
	}

	private async handleStartCommand(message: IncomingMessage, provider: MessagingProvider): Promise<boolean> {
		// Mas aqui tratamos o /start genérico sem parâmetros.
		const identityId = this.getIdentityId(message);
		const isNewUser = await this.isNewUser(message, identityId);
		const providerName = provider.getProviderName();

		if (!isNewUser) {
			await provider.sendMessage(message.externalId, getChannelStartReturningMessage(providerName, env.DASHBOARD_URL));
			return true;
		}

		// WhatsApp é o único canal com trial (sem cadastro prévio obrigatório)
		if (providerName === 'whatsapp') {
			const { getChannelStartNewUserMessage } = await import('@/config/prompts');
			await provider.sendMessage(message.externalId, getChannelStartNewUserMessage(providerName));
			return true;
		}

		// Outros canais: tenta auto-vincular via OAuth já conectado no Dashboard
		const oauthUserId = await userService.findUserIdByOAuthAccount(providerName, identityId);
		if (oauthUserId) {
			await userService.linkAccountToUser(oauthUserId, message.provider as any, identityId, {
				username: message.senderName,
			});
			await provider.sendMessage(message.externalId, getChannelLinkSuccessMessage(providerName));
			return true;
		}

		// Sem OAuth: orienta a criar conta com pre-signup link
		const signupLink = await this.buildPreSignupLink(identityId, message.provider, providerName);
		await provider.sendMessage(message.externalId, getChannelNotRegisteredMessage(providerName, signupLink));

		return true;
	}

	private async handleDeepLink(message: IncomingMessage, provider: MessagingProvider): Promise<boolean> {
		if (!message.linkingToken) return false;

		loggers.webhook.info({ token: message.linkingToken }, '🔗 Processando token de vinculação');

		const identityId = this.getIdentityId(message);
		const linked = await accountLinkingService.linkExternalAccountByToken(message.linkingToken, identityId, {
			username: message.senderName,
		});

		if (linked) {
			await provider.sendMessage(message.externalId, getChannelLinkSuccessMessage(provider.getProviderName()));
		} else {
			await provider.sendMessage(
				message.externalId,
				'❌ Token de vinculação inválido ou expirado. Tente gerar um novo link no painel.',
			);
		}

		return true; // Mensagem foi consumida pelo fluxo de vinculação
	}

	private async isNewUser(message: IncomingMessage, identityId?: string): Promise<boolean> {
		const id = identityId ?? this.getIdentityId(message);
		const account = await userService.findAccount(message.provider as any, id);
		return !account;
	}

	private async buildPreSignupLink(externalId: string, provider: string, providerName: string): Promise<string> {
		const isLocalhost = env.DASHBOARD_URL.includes('localhost') || env.DASHBOARD_URL.includes('127.0.0.1');
		if (isLocalhost) {
			return `${env.DASHBOARD_URL}/signup`;
		}
		const token = await accountLinkingService.generatePreSignupToken(externalId, provider as any);
		return `${env.DASHBOARD_URL}/signup?vinculate_code=${token}`;
	}
}

export const commandHandlerService = instrumentService('commandHandler', new CommandHandlerService());
