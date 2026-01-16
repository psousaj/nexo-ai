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
import { loggers } from '@/utils/logger';

const queueLogger = loggers.queue;

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
export const closeConversationQueue = new Queue<{ conversationId: string }>('close-conversation', REDIS_CONFIG);

queueLogger.info(`✅ Bull configurado com Redis (${env.REDIS_HOST})`);

// ============================================================================
// WORKER - Processa fechamento de conversas
// ============================================================================

/**
 * Worker idempotente com UPDATE condicional para prevenir race conditions
 */
closeConversationQueue.process('close-conversation', async (job) => {
	const { conversationId } = job.data;

	try {
		queueLogger.info({ conversationId }, '🔄 Processando fechamento');

		// UPDATE CONDICIONAL - previne race condition
		// Só fecha se state='waiting_close' E close_at <= now
		const result = await db
			.update(conversations)
			.set({
				state: 'closed',
				closeAt: null,
				closeJobId: null,
				updatedAt: new Date(),
			})
			.where(and(eq(conversations.id, conversationId), eq(conversations.state, 'waiting_close'), lte(conversations.closeAt, new Date())))
			.returning({ id: conversations.id });

		if (result.length === 0) {
			queueLogger.warn({ conversationId }, '⚠️ Conversa já foi fechada/cancelada');
			return;
		}

		queueLogger.info({ conversationId }, '✅ Conversa fechada com sucesso');
	} catch (error) {
		queueLogger.error({ conversationId, err: error }, '❌ Erro ao fechar conversa');
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
		const closeAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutos
		const jobId = `close:${conversationId}`; // JobId determinístico para cancelamento O(1)

		// 1. Atualiza banco PRIMEIRO (source of truth)
		await db
			.update(conversations)
			.set({
				state: 'waiting_close',
				closeAt,
				closeJobId: jobId,
				updatedAt: new Date(),
			})
			.where(eq(conversations.id, conversationId));

		queueLogger.info({ conversationId, closeAt: closeAt.toISOString() }, '📅 Banco atualizado: conversa aguardando fechamento');

		// 2. Enfileira job delayed com jobId customizado
		await closeConversationQueue.add(
			'close-conversation',
			{ conversationId },
			{
				delay: 3 * 60 * 1000,
				jobId, // JobId customizado para lookup O(1)
				attempts: 3,
				backoff: { type: 'exponential', delay: 5000 },
				removeOnComplete: true,
			}
		);

		queueLogger.info({ jobId }, '✅ Job agendado');
	} catch (error) {
		queueLogger.error({ conversationId, err: error }, '❌ Erro ao agendar fechamento');
		// Não joga erro pra cima: o cron de backup vai pegar
	}
}

/**
 * Cancela fechamento agendado (usuário mandou nova mensagem)
 * Usa jobId salvo no banco para cancelamento O(1)
 */
export async function cancelConversationClose(conversationId: string): Promise<void> {
	try {
		// 1. Busca o jobId do banco primeiro
		const [convo] = await db
			.select({ closeJobId: conversations.closeJobId })
			.from(conversations)
			.where(eq(conversations.id, conversationId))
			.limit(1);

		// 2. Atualiza banco
		await db
			.update(conversations)
			.set({
				state: 'idle',
				closeAt: null,
				closeJobId: null,
				updatedAt: new Date(),
			})
			.where(eq(conversations.id, conversationId));

		queueLogger.info({ conversationId }, '🔄 Banco atualizado: conversa voltou pra idle');

		// 3. Remove job da fila com O(1) usando jobId salvo
		if (convo?.closeJobId) {
			const job = await closeConversationQueue.getJob(convo.closeJobId);
			if (job) {
				await job.remove();
				queueLogger.info({ jobId: convo.closeJobId }, '🗑️ Job removido');
			}
		}
	} catch (error) {
		queueLogger.error({ conversationId, err: error }, '❌ Erro ao cancelar fechamento');
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
				closeJobId: null,
				updatedAt: now,
			})
			.where(and(eq(conversations.state, 'waiting_close'), lte(conversations.closeAt, now)))
			.returning({ id: conversations.id });

		const count = result.length;

		if (count > 0) {
			queueLogger.info({ count }, '⏰ CRON: Conversas expiradas fechadas');
		}

		return count;
	} catch (error) {
		queueLogger.error({ err: error }, '❌ Erro no cron de fechamento');
		return 0;
	}
}

/**
 * Cron de timeout para awaiting_confirmation
 * Fecha conversas em awaiting_confirmation há mais de 30 minutos
 * Evita conversas "zumbi" quando usuário não responde
 */
export async function runAwaitingConfirmationTimeoutCron(): Promise<number> {
	try {
		const now = new Date();
		const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

		const result = await db
			.update(conversations)
			.set({
				state: 'closed',
				closeAt: null,
				closeJobId: null,
				context: null,
				updatedAt: now,
			})
			.where(and(eq(conversations.state, 'awaiting_confirmation'), lte(conversations.updatedAt, thirtyMinutesAgo)))
			.returning({ id: conversations.id });

		const count = result.length;

		if (count > 0) {
			queueLogger.info({ count }, '⏰ CRON: Conversas em awaiting_confirmation expiradas fechadas');
		}

		return count;
	} catch (error) {
		queueLogger.error({ err: error }, '❌ Erro no timeout de awaiting_confirmation');
		return 0;
	}
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGTERM', async () => {
	queueLogger.info('🛑 Recebido SIGTERM, fechando queue...');
	await closeConversationQueue.close();
});

process.on('SIGINT', async () => {
	queueLogger.info('🛑 Recebido SIGINT, fechando queue...');
	await closeConversationQueue.close();
});
