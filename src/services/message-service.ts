import { userService } from '@/services/user-service';
import { conversationService } from '@/services/conversation-service';
import { agentOrchestrator } from '@/services/agent-orchestrator';
import { type IncomingMessage, type MessagingProvider } from '@/adapters/messaging';
import { loggers, logError } from '@/utils/logger';
import { TIMEOUT_MESSAGE, ERROR_MESSAGES, FALLBACK_MESSAGES, getRandomMessage } from '@/config/prompts';
import { cancelConversationClose } from '@/services/queue-service';
import { messageAnalyzer } from '@/services/message-analysis/message-analyzer.service';
import { env } from '@/config/env';
import { commandHandlerService } from '@/services/command-handler.service';

export const userTimeouts = new Map<string, number>();

/**
 * Verifica se a mensagem contém conteúdo ofensivo usando nlp.js
 */
async function containsOffensiveContent(message: string): Promise<boolean> {
	const sentiment = await messageAnalyzer.analyzeSentiment(message);
	loggers.webhook.info({ score: sentiment.score, sentiment: sentiment.sentiment, message }, '🛡️ Sentiment Analysis (nlp.js)');
	return sentiment.score < -3;
}

async function isUserInTimeout(userId: string, externalId: string): Promise<boolean> {
	const user = await userService.getUserById(userId);
	if (user?.timeoutUntil) {
		const now = new Date();
		if (now < user.timeoutUntil) return true;
	}
	const timeoutUntil = userTimeouts.get(externalId);
	if (timeoutUntil && Date.now() < timeoutUntil) return true;
	return false;
}

async function applyTimeout(userId: string, externalId: string): Promise<number> {
	const user = await userService.getUserById(userId);
	const offenseCount = (user?.offenseCount || 0) + 1;
	let timeoutMinutes: number;
	if (offenseCount === 1) timeoutMinutes = 5;
	else if (offenseCount === 2) timeoutMinutes = 15;
	else if (offenseCount === 3) timeoutMinutes = 30;
	else timeoutMinutes = 60;
	const timeoutUntil = new Date(Date.now() + timeoutMinutes * 60 * 1000);
	await userService.updateUserTimeout(userId, timeoutUntil, offenseCount);
	userTimeouts.set(externalId, timeoutUntil.getTime());
	return timeoutMinutes;
}

export async function processMessage(incomingMsg: IncomingMessage, provider: MessagingProvider) {
	const messageText = incomingMsg.text;

	loggers.webhook.info(
		{ provider: provider.getProviderName(), externalId: incomingMsg.externalId, message: messageText },
		'📥 Mensagem recebida (Worker)',
	);

	// 1. VERIFICA COMANDOS DE SISTEMA (AGNÓSTICO)
	const handledAsCommand = await commandHandlerService.handleCommand(incomingMsg, provider);
	if (handledAsCommand) {
		loggers.webhook.info('🤖 Comando de sistema processado, encerrando fluxo normal');
		return;
	}

	const startTotal = performance.now();
	let userId: string | undefined;
	let conversationId: string | undefined;

	try {
		if (await containsOffensiveContent(messageText)) {
			const { user } = await userService.findOrCreateUserByAccount(
				incomingMsg.externalId,
				incomingMsg.provider,
				incomingMsg.senderName,
				incomingMsg.phoneNumber,
			);
			userId = user.id;
			const timeoutMinutes = await applyTimeout(user.id, incomingMsg.externalId);
			await provider.sendMessage(incomingMsg.externalId, TIMEOUT_MESSAGE(timeoutMinutes));
			return;
		}

		const { user } = await userService.findOrCreateUserByAccount(
			incomingMsg.externalId,
			incomingMsg.provider,
			incomingMsg.senderName,
			incomingMsg.phoneNumber,
		);
		userId = user.id;

		if (incomingMsg.senderName && incomingMsg.senderName !== user.name) {
			await userService.updateUserName(user.id, incomingMsg.senderName);
		}

		if (await isUserInTimeout(user.id, incomingMsg.externalId)) return;

		const conversation = await conversationService.findOrCreateConversation(user.id);
		conversationId = conversation.id;

		if (conversation.state === 'waiting_close') {
			await cancelConversationClose(conversation.id);
		}

		// 4. VERIFICA ONBOARDING (PHASE 2)
		const { onboardingService } = await import('@/services/onboarding-service');
		const { accountLinkingService } = await import('@/services/account-linking-service');
		const onboarding = await onboardingService.checkOnboardingStatus(user.id, provider.getProviderName());

		if (!onboarding.allowed) {
			const dashboardUrl = `${env.DASHBOARD_URL}/signup`;

			if (onboarding.reason === 'trial_exceeded') {
				// Se tiver conta vinculada, considera como falha de estado mas não bloqueia com mensagem de trial
				// (Pode ser um erro de cache ou estado, mas evita spam de trial para usuários registrados)
				if (user.status === 'active') {
					loggers.webhook.warn({ userId: user.id }, '⚠️ Usuário ativo recebeu trial_exceeded - corrigindo estado ou ignorando');
					// Força update se necessário ou segue fluxo
				} else {
					// Verifica se o usuário tem conta vinculada no UserService
					const accounts = await userService.getUserAccounts(user.id);
					const hasLinkedAccount = accounts.some((acc) => acc.provider !== 'whatsapp'); // Assume que 'whatsapp' é o canal atual restrito

					if (hasLinkedAccount) {
						// Se tem conta vinculada, deveria estar active. Tenta corrigir ou logar erro.
						loggers.webhook.warn({ userId: user.id }, '⚠️ Usuário vinculado caiu no trial_exceeded - checkOnboardingStatus retornou false');
						// Opcional: Auto-ativar usuário?
						// Por segurança, não bloqueia o fluxo.
					} else {
						const signupToken = await accountLinkingService.generateLinkingToken(user.id, 'whatsapp', 'signup');
						const signupLink = `${dashboardUrl}?token=${signupToken}`;

						if (provider.getProviderName() === 'telegram') {
							const msg = `🚀 Você atingiu o limite de 10 mensagens do seu trial gratuito!\n\nPara continuar usando o Nexo AI e desbloquear recursos ilimitados, crie sua conta agora mesmo:`;
							const buttons = [[{ text: '🔗 Clique aqui para criar conta', url: signupLink }]];
							await (provider as any).sendMessageWithButtons(incomingMsg.externalId, msg, buttons);
						} else {
							await provider.sendMessage(
								incomingMsg.externalId,
								`🚀 Você atingiu o limite de 10 mensagens do seu trial gratuito!\n\nPara continuar usando o Nexo AI e desbloquear recursos ilimitados, crie sua conta agora mesmo:\n\n🔗 ${signupLink}`,
							);
						}
						return;
					}
				}
			}

			if (onboarding.reason === 'signup_required') {
				const accounts = await userService.getUserAccounts(user.id);
				const isNewUser = accounts.length <= 1;

				if (isNewUser) {
					const signupToken = await accountLinkingService.generateLinkingToken(user.id, provider.getProviderName() as any, 'signup');
					const signupLink = `${dashboardUrl}?token=${signupToken}`;

					if (provider.getProviderName() === 'telegram') {
						const msg = `Olá! 😊\n\nPara começar a usar o Nexo AI por aqui, você precisa concluir seu cadastro rápido no nosso painel:\n\nÉ rapidinho e você já poderá salvar tudo o que quiser!`;
						const buttons = [[{ text: '🔗 Clique aqui para cadastrar', url: signupLink }]];
						await (provider as any).sendMessageWithButtons(incomingMsg.externalId, msg, buttons);
					} else {
						// Padrão (WhatsApp e outros)
						await provider.sendMessage(
							incomingMsg.externalId,
							`Olá! 😊\n\nPara começar a usar o Nexo AI por aqui, você precisa concluir seu cadastro rápido no nosso painel:\n\n🔗 ${signupLink}\n\nÉ rapidinho e você já poderá salvar tudo o que quiser!`,
						);
					}
					return;
				} else {
					// Se tem mais contas, assume que é usuário existente e permite fluxo (provavelmente status desatualizado)
					// Loga para debug
					loggers.webhook.info({ userId: user.id, accounts: accounts.length }, 'ℹ️ Usuário multi-conta pending_signup ignorando bloqueio');
				}
			}
		}

		// Incrementa interações APENAS se não for bloqueado
		await onboardingService.incrementInteractionCount(user.id);

		// Envia indicador "digitando..." para o usuário enquanto processa IA
		if (provider.getProviderName() === 'telegram') {
			await (provider as any).sendChatAction(incomingMsg.externalId, 'typing');
		}

		const agentResponse = await agentOrchestrator.processMessage({
			userId: user.id,
			conversationId: conversation.id,
			externalId: incomingMsg.externalId,
			message: messageText,
			callbackData: incomingMsg.callbackData,
			provider: provider.getProviderName(),
		});

		if (agentResponse.message && agentResponse.message.trim().length > 0) {
			try {
				await provider.sendMessage(incomingMsg.externalId, agentResponse.message);
				loggers.webhook.info({ charCount: agentResponse.message.length }, '📤 Resposta enviada');
			} catch (sendError: any) {
				// Se erro de rede (ETIMEDOUT, ECONNREFUSED), não tenta fallback
				if (sendError.cause?.code === 'ETIMEDOUT' || sendError.cause?.code === 'ECONNREFUSED') {
					loggers.webhook.error({ error: sendError.cause?.code }, '❌ Erro de rede ao enviar mensagem - não enviando fallback');
					throw sendError; // Re-throw para Bull não fazer retry
				}
				throw sendError;
			}
		} else if (!agentResponse.skipFallback && agentResponse.state !== 'awaiting_context') {
			// Fallback apenas se não foi enviado manualmente via adapter
			// E se não estamos aguardando clarificação (mensagem já foi enviada pelo conversationService)
			const fallbackMsg = getRandomMessage(FALLBACK_MESSAGES);
			try {
				await provider.sendMessage(incomingMsg.externalId, fallbackMsg);
				loggers.webhook.info({ fallback: fallbackMsg }, '🚫 NOOP/Empty - enviando fallback');
			} catch (sendError: any) {
				// Se erro de rede, apenas loga e retorna
				if (sendError.cause?.code === 'ETIMEDOUT' || sendError.cause?.code === 'ECONNREFUSED') {
					loggers.webhook.error({ error: sendError.cause?.code }, '❌ Erro de rede ao enviar fallback - abortando');
					throw sendError;
				}
				throw sendError;
			}
		}

		if (agentResponse.toolsUsed && agentResponse.toolsUsed.length > 0) {
			loggers.webhook.info({ tools: agentResponse.toolsUsed }, '🔧 Tools usadas');
		}

		const endTotal = performance.now();
		loggers.webhook.info({ duration: `${(endTotal - startTotal).toFixed(0)}*ms*` }, '🏁 Processamento finalizado');
	} catch (error: any) {
		// Anexa contexto capturado para o Global Error Handler
		error.userId = userId;
		error.conversationId = conversationId;
		// Apenas tenta avisar o usuário se não for erro de conexão
		// O Global Error Handler (via Queue) vai cuidar de logar e persistir tudo com contexto
		if (error.cause?.code !== 'ETIMEDOUT' && error.cause?.code !== 'ECONNREFUSED') {
			try {
				const errorMsg = getRandomMessage(ERROR_MESSAGES);
				await provider.sendMessage(incomingMsg.externalId, errorMsg);
			} catch (sendError) {
				// Ignora erro de envio de falha
			}
		}

		// Re-throw OBRIGATÓRIO para o Bull capturar e chamar worker.on('failed') -> GlobalErrorHandler
		throw error;
	}
}
