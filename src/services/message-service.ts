import Sentiment from 'sentiment';
import { userService } from '@/services/user-service';
import { conversationService } from '@/services/conversation-service';
import { agentOrchestrator } from '@/services/agent-orchestrator';
import { type IncomingMessage, type MessagingProvider } from '@/adapters/messaging';
import { loggers, logError } from '@/utils/logger';
import { TIMEOUT_MESSAGE, GENERIC_ERROR } from '@/config/prompts';
import { cancelConversationClose } from '@/services/queue-service';

export const userTimeouts = new Map<string, number>();

const sentiment = new Sentiment();
sentiment.registerLanguage('pt', {
	labels: {
		fdp: -5,
		'filho da puta': -5,
		'puta que pariu': -5,
		'vai tomar no cu': -5,
		vtmnc: -5,
		vsf: -5,
		'vai se fuder': -5,
		cu: -3,
		caralho: -3,
		porra: -3,
		merda: -3,
		bosta: -3,
		burro: -2,
		idiota: -2,
		imbecil: -2,
		retardado: -2,
		estúpido: -2,
		'cala a boca': -4,
		'cala boca': -4,
		lixo: -2,
		inútil: -2,
		incompetente: -2,
	},
});

function containsOffensiveContent(message: string): boolean {
	const result = sentiment.analyze(message, { language: 'pt' });
	loggers.webhook.info({ score: result.score, message }, '🛡️ Sentiment Analysis');
	return result.score < 0;
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
		'📥 Mensagem recebida (Worker)'
	);

	const startTotal = performance.now();

	try {
		if (containsOffensiveContent(messageText)) {
			const { user } = await userService.findOrCreateUserByAccount(
				incomingMsg.externalId,
				incomingMsg.provider,
				incomingMsg.senderName,
				incomingMsg.phoneNumber
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
			incomingMsg.phoneNumber
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
			await provider.sendMessage(incomingMsg.externalId, agentResponse.message);
			loggers.webhook.info({ charCount: agentResponse.message.length }, '📤 Resposta enviada');
		} else {
			// Fallback total para garantir que o usuário não fique sem resposta (e o webhook não retente)
			const fallbackMsg = 'Entendido! 👍';
			await provider.sendMessage(incomingMsg.externalId, fallbackMsg);
			loggers.webhook.info({ fallback: fallbackMsg }, '🚫 NOOP/Empty - enviando fallback');
		}

		if (agentResponse.toolsUsed && agentResponse.toolsUsed.length > 0) {
			loggers.webhook.info({ tools: agentResponse.toolsUsed }, '🔧 Tools usadas');
		}

		const endTotal = performance.now();
		loggers.webhook.info({ duration: `${(endTotal - startTotal).toFixed(0)}*ms*` }, '🏁 Processamento finalizado');
	} catch (error) {
		logError(error, { context: 'MESSAGE_PROCESSOR', provider: provider.getProviderName() });

		const errorMsg = GENERIC_ERROR;
		await provider.sendMessage(incomingMsg.externalId, errorMsg);
	}
}
