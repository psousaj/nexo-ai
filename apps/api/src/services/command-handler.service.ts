import { type IncomingMessage, type MessagingProvider } from '@/adapters/messaging';
import { userService } from '@/services/user-service';
import { accountLinkingService } from '@/services/account-linking-service';
import { env } from '@/config/env';
import { loggers } from '@/utils/logger';

/**
 * Serviço centralizado para processar comandos do sistema (/start, /vincular, etc.)
 * Funciona de forma agnóstica ao provider.
 */
export class CommandHandlerService {
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
		const { user } = await userService.findOrCreateUserByAccount(message.externalId, message.provider, message.senderName);

		const token = await accountLinkingService.generateLinkingToken(user.id, message.provider, 'link');

		await provider.sendMessage(
			message.externalId,
			`🔑 Seu código de vinculação é: **${token}**\n\nAcesse o seu painel e insira este código para unificar suas contas:\n\n🔗 ${env.DASHBOARD_URL}/profile`,
		);

		return true;
	}

	private async handleStartCommand(message: IncomingMessage, provider: MessagingProvider): Promise<boolean> {
		// Se for Telegram e tiver token no start, o webhook já deve ter processado ou vai processar.
		// Mas aqui tratamos o /start genérico sem parâmetros.

		const isNewUser = await this.isNewUser(message);

		if (isNewUser) {
			await provider.sendMessage(
				message.externalId,
				`Olá! 😊\n\nBem-vindo ao Nexo AI, sua segunda memória inteligente.\n\nEu ajudo você a organizar links, notas e memórias importantes diretamente por aqui.\n\nPara começar, basta me enviar qualquer mensagem!`,
			);
		} else {
			await provider.sendMessage(
				message.externalId,
				`Olá de volta! 😊\n\nSe você quer vincular sua conta para usar em outros dispositivos, você tem duas opções:\n\n1. Digite \`/vincular\` aqui agora para receber um código.\n2. Ou acesse seu painel: 🔗 ${env.DASHBOARD_URL}/profile`,
			);
		}

		return true;
	}

	private async handleDeepLink(message: IncomingMessage, provider: MessagingProvider): Promise<boolean> {
		if (!message.linkingToken) return false;

		loggers.webhook.info({ token: message.linkingToken }, '🔗 Processando token de vinculação');

		const linked = await accountLinkingService.linkExternalAccountByToken(message.linkingToken, message.externalId, {
			username: message.senderName,
		});

		if (linked) {
			await provider.sendMessage(
				message.externalId,
				'✅ Sua conta foi vinculada com sucesso ao seu painel Nexo AI!\n\nO que você quer salvar hoje?',
			);
		} else {
			await provider.sendMessage(message.externalId, '❌ Token de vinculação inválido ou expirado. Tente gerar um novo link no painel.');
		}

		return true; // Mensagem foi consumida pelo fluxo de vinculação
	}

	private async isNewUser(message: IncomingMessage): Promise<boolean> {
		const account = await userService.findAccount(message.provider as any, message.externalId);
		return !account;
	}
}

export const commandHandlerService = new CommandHandlerService();
