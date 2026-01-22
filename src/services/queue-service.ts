import Queue from 'bull';
import { env } from '@/config/env';
import { db } from '@/db';
import { conversations } from '@/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { loggers } from '@/utils/logger';
import { type IncomingMessage, type ProviderType, getProvider } from '@/adapters/messaging';
import { globalErrorHandler } from '@/services/error/error.service';

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
		username: env.REDIS_USER,
		// TLS não é necessário para Redis Cloud via Bull
		// O ioredis usado pelo Bull funciona melhor sem TLS explícito
	},
};

queueLogger.info(
	{
		host: env.REDIS_HOST,
		port: env.REDIS_PORT,
		user: env.REDIS_USER,
		tls: env.REDIS_TLS,
	},
	'🔧 Configuração do Redis',
);

/**
 * Queue para fechamento de conversas
 */
export const closeConversationQueue = new Queue<{ conversationId: string }>('close-conversation', REDIS_CONFIG);

queueLogger.info('✅ Queue "close-conversation" criada');

/**
 * Queue para processamento de mensagens recebidas (Webhooks)
 */
export const messageQueue = new Queue<{
	incomingMsg: IncomingMessage;
	providerName: ProviderType;
}>('message-processing', REDIS_CONFIG);

queueLogger.info('✅ Queue "message-processing" criada');

queueLogger.info(`🎯 Bull configurado com sucesso (${env.REDIS_HOST})`);

// ============================================================================
// EVENT LISTENERS - Debug de conexão
// ============================================================================

closeConversationQueue.on('error', (error) => {
	queueLogger.error({ err: error }, '❌ [close-conversation] Erro na queue');
});

closeConversationQueue.on('ready', () => {
	queueLogger.info('✅ [close-conversation] Queue pronta');
});

messageQueue.on('error', (error) => {
	queueLogger.error({ err: error }, '❌ [message-processing] Erro na queue');
});

messageQueue.on('ready', () => {
	queueLogger.info('✅ [message-processing] Queue pronta');
});

closeConversationQueue.on('active', (job) => {
	queueLogger.debug({ jobId: job.id }, '🔄 [close-conversation] Job ativo');
});

messageQueue.on('active', (job) => {
	queueLogger.debug({ jobId: job.id }, '🔄 [message-processing] Job ativo');
});

closeConversationQueue.on('failed', async (job, error) => {
	queueLogger.error({ jobId: job.id, err: error }, '❌ [close-conversation] Job falhou');
	await globalErrorHandler.handle(error, {
		conversationId: job.data.conversationId,
		provider: 'queue',
		state: 'background_job',
		extra: { jobId: job.id, queue: 'close-conversation' },
	});
});

messageQueue.on('failed', async (job, error: any) => {
	queueLogger.error({ jobId: job.id, err: error }, '❌ [message-processing] Job falhou');

	// Extrai contexto anexado ao erro (se disponível)
	const conversationId = error.conversationId;
	const userId = error.userId;

	await globalErrorHandler.handle(error, {
		provider: job.data.providerName,
		conversationId,
		userId,
		extra: {
			jobId: job.id,
			externalId: job.data.incomingMsg.externalId,
			queue: 'message-processing',
		},
	});
});

// ============================================================================
// WORKER - Processa fechamento de conversas
// ============================================================================

closeConversationQueue.process('close-conversation', async (job) => {
	const { conversationId } = job.data;

	try {
		queueLogger.info({ conversationId }, '🔄 Processando fechamento');

		// UPDATE CONDICIONAL - previne race condition
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

/**
 * Worker: Processa mensagens enfileiradas do webhook
 */
messageQueue.process('message-processing', async (job) => {
	const { incomingMsg, providerName } = job.data;

	try {
		queueLogger.info(
			{ providerName, externalId: incomingMsg.externalId, jobId: job.id },
			'🚀 [Worker] Iniciando processamento de mensagem',
		);

		const { processMessage } = await import('./message-service');
		const provider = getProvider(providerName);

		if (!provider) {
			throw new Error(`Provider ${providerName} não encontrado para o job`);
		}

		await processMessage(incomingMsg, provider);

		queueLogger.info({ providerName, externalId: incomingMsg.externalId, jobId: job.id }, '✅ [Worker] Mensagem processada com sucesso');
	} catch (error) {
		queueLogger.error(
			{ providerName, externalId: incomingMsg.externalId, jobId: job.id, err: error },
			'❌ [Worker] Erro ao processar mensagem na fila',
		);
		throw error;
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

		await closeConversationQueue.add(
			'close-conversation',
			{ conversationId },
			{
				delay: 3 * 60 * 1000,
				jobId,
				attempts: 3,
				backoff: { type: 'exponential', delay: 5000 },
				removeOnComplete: true,
			},
		);

		queueLogger.info({ jobId }, '✅ Job agendado');
	} catch (error) {
		queueLogger.error({ conversationId, err: error }, '❌ Erro ao agendar fechamento');
	}
}

/**
 * Cancela fechamento agendado
 */
export async function cancelConversationClose(conversationId: string): Promise<void> {
	try {
		const [convo] = await db
			.select({ closeJobId: conversations.closeJobId })
			.from(conversations)
			.where(eq(conversations.id, conversationId))
			.limit(1);

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

		if (convo?.closeJobId) {
			const job = await closeConversationQueue.getJob(convo.closeJobId);
			if (job) {
				await job.remove();
				queueLogger.info({ jobId: convo.closeJobId }, '🗑️ Job removido');
			}
		}
	} catch (error) {
		queueLogger.error({ conversationId, err: error }, '❌ Erro ao cancelar fechamento');
	}
}

/**
 * Cron de backup: fecha conversas que deveriam estar fechadas
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
	queueLogger.info('🛑 Recebido SIGTERM, fechando queues...');
	await Promise.all([closeConversationQueue.close(), messageQueue.close()]);
});

process.on('SIGINT', async () => {
	queueLogger.info('🛑 Recebido SIGINT, fechando queues...');
	await Promise.all([closeConversationQueue.close(), messageQueue.close()]);
});
