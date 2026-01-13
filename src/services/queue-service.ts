/**
 * Queue Service - Bull + Redis (Upstash)
 * 
 * Gerencia fechamento automático de conversas com delayed jobs.
 * 
 * Arquitetura:
 * - Redis (Upstash) = aceleração
 * - DB = source of truth
 * - Jobs idempotentes sempre checam estado no banco
 */

import Queue from 'bull';
import { env } from '@/config/env';
import { db } from '@/db';
import { conversations } from '@/db/schema';
import { eq, and, lte } from 'drizzle-orm';

// ============================================================================
// QUEUE SETUP
// ============================================================================

// Validação de variáveis obrigatórias
if (!env.REDIS_HOST || !env.REDIS_PASSWORD) {
	throw new Error('Redis não configurado: REDIS_HOST e REDIS_PASSWORD são obrigatórios');
}

const REDIS_CONFIG = {
	redis: {
		host: env.REDIS_HOST,
		port: env.REDIS_PORT || 6379,
		password: env.REDIS_PASSWORD,
		tls: env.REDIS_TLS ? {} : undefined,
	},
};

/**
 * Queue para fechamento de conversas
 */
export const closeConversationQueue = new Queue<{ conversationId: string }>(
	'close-conversation',
	REDIS_CONFIG
);

console.log(`✅ [Queue] Bull configurado com Redis (${env.REDIS_HOST})`);

// ============================================================================
// WORKER - Processa fechamento de conversas
// ============================================================================

/**
 * Worker idempotente: SEMPRE checa o estado no banco antes de fechar
 */
closeConversationQueue.process('close-conversation', async (job) => {
	const { conversationId } = job.data;

	try {
		console.log(`🔄 [Queue] Processando fechamento: ${conversationId}`);

		// Busca conversa no banco (source of truth)
		const [convo] = await db
			.select()
			.from(conversations)
			.where(eq(conversations.id, conversationId))
			.limit(1);

		if (!convo) {
			console.log(`⚠️ [Queue] Conversa ${conversationId} não existe mais`);
			return;
		}

		// Checagem vital: só fecha se ainda estiver waiting_close
		if (convo.state !== 'waiting_close') {
			console.log(`⚠️ [Queue] Conversa ${conversationId} não está em waiting_close (${convo.state}), ignorando`);
			return;
		}

		// Se close_at ainda não passou, não fecha
		if (convo.closeAt && convo.closeAt > new Date()) {
			console.log(`⚠️ [Queue] Conversa ${conversationId} ainda não deve fechar (${convo.closeAt}), ignorando`);
			return;
		}

		// ✅ FECHA A CONVERSA
		await db
			.update(conversations)
			.set({
				state: 'closed',
				closeAt: null,
				updatedAt: new Date(),
			})
			.where(eq(conversations.id, conversationId));

		console.log(`✅ [Queue] Conversa ${conversationId} fechada com sucesso`);
	} catch (error) {
		console.error(`❌ [Queue] Erro ao fechar conversa ${conversationId}:`, error);
		throw error; // Bull vai fazer retry
	}
});

// ============================================================================
// FUNÇÕES PÚBLICAS
// ============================================================================

/**
 * Agenda fechamento de conversa em 3 minutos
 */
export async function scheduleConversationClose(conversationId: string): Promise<void> {
	try {
		// 1. Atualiza banco PRIMEIRO (source of truth)
		const closeAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutos

		await db
			.update(conversations)
			.set({
				state: 'waiting_close',
				closeAt,
				updatedAt: new Date(),
			})
			.where(eq(conversations.id, conversationId));

		console.log(`📅 [Queue] Banco atualizado: ${conversationId} fecha em ${closeAt.toISOString()}`);

		// 2. Enfileira job delayed (otimização)
		await closeConversationQueue.add(
			'close-conversation',
			{ conversationId },
			{
				delay: 3 * 60 * 1000, // 3 minutos
				attempts: 3, // Retry até 3x se falhar
				backoff: {
					type: 'exponential',
					delay: 5000,
				},
				removeOnComplete: true, // Limpa job após sucesso
			}
		);

		console.log(`✅ [Queue] Job agendado para ${conversationId}`);
	} catch (error) {
		console.error(`❌ [Queue] Erro ao agendar fechamento de ${conversationId}:`, error);
		// Não joga erro pra cima: o cron de backup vai pegar
	}
}

/**
 * Cancela fechamento agendado (usuário mandou nova mensagem)
 */
export async function cancelConversationClose(conversationId: string): Promise<void> {
	try {
		// 1. Atualiza banco PRIMEIRO
		await db
			.update(conversations)
			.set({
				state: 'idle',
				closeAt: null,
				updatedAt: new Date(),
			})
			.where(eq(conversations.id, conversationId));

		console.log(`🔄 [Queue] Banco atualizado: ${conversationId} voltou pra open`);

		// 2. Remove job da fila (se existir)
		const jobs = await closeConversationQueue.getDelayed();
		const job = jobs.find((j) => j.data.conversationId === conversationId);

		if (job) {
			await job.remove();
			console.log(`🗑️ [Queue] Job removido para ${conversationId}`);
		}
	} catch (error) {
		console.error(`❌ [Queue] Erro ao cancelar fechamento de ${conversationId}:`, error);
		// Não joga erro: o worker vai checar o estado e não vai fechar
	}
}

/**
 * Cron de backup: fecha conversas que deveriam estar fechadas
 * Roda a cada 1 minuto
 * 
 * Salva o sistema se:
 * - Redis cair
 * - Bull travar
 * - Worker morrer
 * - Deploy no meio do job
 */
export async function runConversationCloseCron(): Promise<number> {
	try {
		const now = new Date();

		const result = await db
			.update(conversations)
			.set({
				state: 'closed',
				closeAt: null,
				updatedAt: now,
			})
			.where(
				and(
					eq(conversations.state, 'waiting_close'),
					lte(conversations.closeAt, now)
				)
			)
			.returning({ id: conversations.id });

		const count = result.length;

		if (count > 0) {
			console.log(`🔧 [Cron] ${count} conversa(s) fechada(s) pelo backup`);
		}

		return count;
	} catch (error) {
		console.error('❌ [Cron] Erro no cron de fechamento:', error);
		return 0;
	}
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGTERM', async () => {
	console.log('🛑 [Queue] Recebido SIGTERM, fechando queue...');
	await closeConversationQueue.close();
});

process.on('SIGINT', async () => {
	console.log('🛑 [Queue] Recebido SIGINT, fechando queue...');
	await closeConversationQueue.close();
});
