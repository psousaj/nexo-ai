import { userService } from '@/services/user-service';
import { conversationService } from '@/services/conversation-service';
import { agentOrchestrator } from '@/services/agent-orchestrator';
import { type IncomingMessage, type MessagingProvider } from '@/adapters/messaging';
import { loggers, logError } from '@/utils/logger';
import { TIMEOUT_MESSAGE, ERROR_MESSAGES, FALLBACK_MESSAGES, getRandomMessage } from '@/config/prompts';
import { cancelConversationClose } from '@/services/queue-service';
import { messageAnalyzer } from '@/services/message-analysis/message-analyzer.service';

export const userTimeouts = new Map<string, number>();

/**
 * Verifica se a mensagem contém conteúdo ofensivo usando nlp.js
 * Substitui a implementação anterior com a biblioteca 'sentiment'
 */
async function containsOffensiveContent(message: string): Promise<boolean> {
	const sentiment = await messageAnalyzer.analyzeSentiment(message);
	loggers.webhook.info({ score: sentiment.score, sentiment: sentiment.sentiment, message }, '🛡️ Sentiment Analysis (nlp.js)');
	// Score muito negativo indica conteúdo ofensivo
	return sentiment.score < -3;
}

async function isUserInTimeout(userId: string, externalId: string): Promise<boolean> {
	const user = await userService.getUserById(userId);

	if (user?.timeoutUntil) {
		const now = new Date();
		if (now < user.timeoutUntil) {
			return true;
		}
	}

	const timeoutUntil = userTimeouts.get(externalId);
	if (timeoutUntil && Date.now() < timeoutUntil) {
		return true;
	}

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

	loggers.webhook.info({ offenseCount, timeoutMinutes }, '⏳ Timeout aplicado');
	return timeoutMinutes;
}

export async function processMessage(incomingMsg: IncomingMessage, provider: MessagingProvider) {
	const messageText = incomingMsg.text;

	loggers.webhook.info(
		{ provider: provider.getProviderName(), externalId: incomingMsg.externalId, message: messageText },
		'📥 Mensagem recebida (Worker)',
	);

	const startTotal = performance.now();

	try {
		// Usa o novo serviço de análise para detectar conteúdo ofensivo
		if (await containsOffensiveContent(messageText)) {
			const { user } = await userService.findOrCreateUserByAccount(
				incomingMsg.externalId,
				incomingMsg.provider,
				incomingMsg.senderName,
				incomingMsg.phoneNumber,
			);

			const timeoutMinutes = await applyTimeout(user.id, incomingMsg.externalId);
			const response = TIMEOUT_MESSAGE(timeoutMinutes);

			await provider.sendMessage(incomingMsg.externalId, response);
			loggers.webhook.warn('🛡️ Conteúdo ofensivo detectado');
			return;
		}

		const { user } = await userService.findOrCreateUserByAccount(
			incomingMsg.externalId,
			incomingMsg.provider,
			incomingMsg.senderName,
			incomingMsg.phoneNumber,
		);

		if (incomingMsg.senderName && incomingMsg.senderName !== user.name) {
			await userService.updateUserName(user.id, incomingMsg.senderName);
		}

		if (await isUserInTimeout(user.id, incomingMsg.externalId)) {
			loggers.webhook.info('⏳ Usuário em timeout, ignorando');
			return;
		}

		const conversation = await conversationService.findOrCreateConversation(user.id);
		if (!conversation) {
			throw new Error('Falha ao obter conversação');
		}

		if (conversation.state === 'waiting_close') {
			await cancelConversationClose(conversation.id);
			loggers.webhook.info('🔄 Fechamento de conversa cancelado');
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
		} else if (!agentResponse.skipFallback) {
			// Fallback apenas se não foi enviado manualmente via adapter
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
