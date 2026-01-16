/**
 * Webhook unificado usando novo Agent Orchestrator
 *
 * ANTES: Tudo no webhook (classificação, lógica, AI, tools)
 * AGORA: Webhook apenas traduz e delega para orquestrador
 */

import { Elysia } from 'elysia';
import Sentiment from 'sentiment';
import { userService } from '@/services/user-service';
import { conversationService } from '@/services/conversation-service';
import { agentOrchestrator } from '@/services/agent-orchestrator';
import { whatsappAdapter, telegramAdapter, type IncomingMessage, type MessagingProvider } from '@/adapters/messaging';
import { env } from '@/config/env';
import { TIMEOUT_MESSAGE, GENERIC_ERROR } from '@/config/prompts';
import { cancelConversationClose } from '@/services/queue-service';

/**
 * Armazena timeouts de usuários ofensivos (em memória)
 */
export const userTimeouts = new Map<string, number>();

/**
 * Detecta conteúdo ofensivo usando Sentiment JS
 */
const sentiment = new Sentiment();
sentiment.registerLanguage('pt', {
	labels: {
		'fdp': -5,
		'filho da puta': -5,
		'puta que pariu': -5,
		'vai tomar no cu': -5,
		'vtmnc': -5,
		'vsf': -5,
		'vai se fuder': -5,
		'cu': -3,
		'caralho': -3,
		'porra': -3,
		'merda': -3,
		'bosta': -3,
		'burro': -2,
		'idiota': -2,
		'imbecil': -2,
		'retardado': -2,
		'estúpido': -2,
		'cala a boca': -4,
		'cala boca': -4,
		'lixo': -2,
		'inútil': -2,
		'incompetente': -2
	}
});

function containsOffensiveContent(message: string): boolean {
	const result = sentiment.analyze(message, { language: 'pt' });
	console.log(`🛡️ Sentiment Analysis: Score=${result.score} | Msg="${message}"`);
	return result.score < 0;
}

/**
 * Verifica se usuário está em timeout
 */
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

/**
 * Aplica timeout progressivo
 */
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

	console.log(`⏱️ Timeout #${offenseCount} aplicado: ${timeoutMinutes}min`);
	return timeoutMinutes;
}

/**
 * Processa mensagem (provider-agnostic)
 *
 * SIMPLIFICADO: Apenas valida e delega para orquestrador
 */
async function processMessage(incomingMsg: IncomingMessage, provider: MessagingProvider) {
	const messageText = incomingMsg.text;

	console.log(`\n📨 [${provider.getProviderName()}] ${incomingMsg.externalId}: "${messageText}"`);

	try {
		// 1. DETECTA OFENSAS (regra determinística, não LLM)
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
			console.warn('⚠️ Conteúdo ofensivo detectado');
			return;
		}

		// 2. BUSCA/CRIA USUÁRIO (unificação cross-provider)
		const { user } = await userService.findOrCreateUserByAccount(
			incomingMsg.externalId,
			incomingMsg.provider,
			incomingMsg.senderName,
			incomingMsg.phoneNumber
		);

		// Atualiza nome se mudou
		if (incomingMsg.senderName && incomingMsg.senderName !== user.name) {
			await userService.updateUserName(user.id, incomingMsg.senderName);
		}

		// 3. VERIFICA TIMEOUT
		if (await isUserInTimeout(user.id, incomingMsg.externalId)) {
			console.log('⏸️ Usuário em timeout, ignorando');
			return;
		}

		// 4. BUSCA/CRIA CONVERSAÇÃO
		// Se conversa está closed, findOrCreateConversation cria uma nova automaticamente
		const conversation = await conversationService.findOrCreateConversation(user.id);
		if (!conversation) {
			throw new Error('Falha ao obter conversação');
		}

		// 4.1. CANCELA FECHAMENTO SE ESTAVA AGENDADO
		// Nova mensagem = usuário voltou, cancela o timer de 3min
		// cancelConversationClose já atualiza estado para idle automaticamente
		if (conversation.state === 'waiting_close') {
			await cancelConversationClose(conversation.id);
			console.log(`🔄 [Webhook] Fechamento cancelado`);
		}

		// 5. DELEGA PARA ORQUESTRADOR (toda lógica aqui)
		const agentResponse = await agentOrchestrator.processMessage({
			userId: user.id,
			conversationId: conversation.id,
			externalId: incomingMsg.externalId,
			message: messageText,
		});

		// 6. ENVIA RESPOSTA (se houver)
		if (agentResponse.message && agentResponse.message.trim().length > 0) {
			await provider.sendMessage(incomingMsg.externalId, agentResponse.message);
			console.log(`✅ Resposta enviada (${agentResponse.message.length} chars)`);
		} else {
			console.log('🚫 NOOP - nenhuma mensagem enviada ao usuário');
		}

		if (agentResponse.toolsUsed && agentResponse.toolsUsed.length > 0) {
			console.log(`🔧 Tools usadas: ${agentResponse.toolsUsed.join(', ')}`);
		}
	} catch (error) {
		console.error('❌ Erro ao processar mensagem:', error);

		const errorMsg = GENERIC_ERROR;
		await provider.sendMessage(incomingMsg.externalId, errorMsg);
	}
}

/**
 * Rotas do webhook
 */
export const webhookRoutes = new Elysia({ prefix: '/webhook' })
	// TELEGRAM
	.post('/telegram', async ({ body }) => {
		console.log('📥 [Webhook] Telegram recebido');
		
		if (!env.TELEGRAM_BOT_TOKEN) {
			return { error: 'Telegram not configured' };
		}

		try {
			const message = telegramAdapter.parseIncomingMessage(body);
			if (message) {
				await processMessage(message, telegramAdapter);
			}
			return { ok: true };
		} catch (error) {
			console.error('❌ Erro Telegram webhook:', error);
			return { ok: false };
		}
	})

	// WHATSAPP
	.get('/meta', ({ query }) => {
		const mode = query['hub.mode'];
		const token = query['hub.verify_token'];
		const challenge = query['hub.challenge'];

		if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
			console.log('✅ Webhook WhatsApp verificado');
			return new Response(challenge);
		}

		return new Response('Verification failed', { status: 403 });
	})
	.post('/meta', async ({ body }) => {
		if (!whatsappAdapter) {
			return { error: 'WhatsApp not configured' };
		}

		try {
			const message = whatsappAdapter.parseIncomingMessage(body);
			if (message) {
				await processMessage(message, whatsappAdapter);
			}
			return { status: 'ok' };
		} catch (error) {
			console.error('❌ Erro WhatsApp webhook:', error);
			return { status: 'error' };
		}
	});
