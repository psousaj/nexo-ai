import { type IncomingMessage, type ProviderType, getProvider } from '@/adapters/messaging';
import { env } from '@/config/env';
import { db } from '@/db';
import { conversations, semanticExternalItems } from '@/db/schema';
import { embeddingService } from '@/services/ai/embedding-service';
import { globalErrorHandler } from '@/services/error/error.service';
import { loggers } from '@/utils/logger';
import { startSpan, setAttributes, recordException } from '@nexo/otel/tracing';
import Queue from 'bull';
import { and, eq, inArray, lte } from 'drizzle-orm';

/**
 * Response Queue Job Interface
 */
export interface ResponseJob {
	externalId: string;
	message: string;
	provider: ProviderType;
	metadata?: {
		conversationId?: string;
		userId?: string;
		attempt?: number;
	};
}

/**
 * Enrichment Queue Job Interface
 */
export interface ItemCandidate {
	id: number | string;
	title?: string;
	name?: string;
	overview?: string;
	[key: string]: any;
}

export interface EnrichmentJob {
	candidates: ItemCandidate[];
	provider: 'tmdb' | 'youtube';
	type: 'movie' | 'tv_show' | 'video';
}

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

/**
 * Queue para envio de respostas com retry automático
 */
export const responseQueue = new Queue<ResponseJob>('response-sending', REDIS_CONFIG);

queueLogger.info('✅ Queue "response-sending" criada');

/**
 * Queue para enriquecimento de dados em background (Bulk Async Enrichment)
 */
export const enrichmentQueue = new Queue<EnrichmentJob>('enrichment-processing', REDIS_CONFIG);

queueLogger.info('✅ Queue "enrichment-processing" criada');

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

responseQueue.on('error', (error) => {
	queueLogger.error({ err: error }, '❌ [response-sending] Erro na queue');
});

responseQueue.on('ready', () => {
	queueLogger.info('✅ [response-sending] Queue pronta');
});

enrichmentQueue.on('error', (error) => {
	queueLogger.error({ err: error }, '❌ [enrichment-processing] Erro na queue');
});

enrichmentQueue.on('ready', () => {
	queueLogger.info('✅ [enrichment-processing] Queue pronta');
});

closeConversationQueue.on('active', (job) => {
	queueLogger.debug({ jobId: job.id }, '🔄 [close-conversation] Job ativo');
});

messageQueue.on('active', (job) => {
	queueLogger.debug({ jobId: job.id }, '🔄 [message-processing] Job ativo');
});

responseQueue.on('active', (job) => {
	queueLogger.debug({ jobId: job.id }, '🔄 [response-sending] Job ativo');
});

enrichmentQueue.on('active', (job) => {
	queueLogger.debug({ jobId: job.id }, '🔄 [enrichment-processing] Job ativo');
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

responseQueue.on('failed', async (job, error) => {
	if (job) {
		queueLogger.error(
			{
				jobId: job.id,
				externalId: job.data.externalId,
				error: error.message,
				attempts: job.attemptsMade,
			},
			'❌ [response-sending] Job falhou',
		);
	}
});

// ============================================================================
// WORKER - Processa fechamento de conversas
// ============================================================================

closeConversationQueue.process('close-conversation', async (job) => {
	return startSpan('queue.close_conversation.process', async (span) => {
		const { conversationId } = job.data;

		setAttributes({
			'queue.name': 'close-conversation',
			'queue.job_id': String(job.id),
			'conversation.id': conversationId,
		});

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
				.where(
					and(
						eq(conversations.id, conversationId),
						eq(conversations.state, 'waiting_close'),
						lte(conversations.closeAt, new Date()),
					),
				)
				.returning({ id: conversations.id });

			if (result.length === 0) {
				setAttributes({ 'queue.status': 'already_closed' });
				queueLogger.warn({ conversationId }, '⚠️ Conversa já foi fechada/cancelada');
				return;
			}

			setAttributes({ 'queue.status': 'closed' });
			queueLogger.info({ conversationId }, '✅ Conversa fechada com sucesso');
		} catch (error) {
			recordException(error as Error, { 'queue.status': 'error' });
			queueLogger.error({ conversationId, err: error }, '❌ Erro ao fechar conversa');
			throw error; // Bull vai fazer retry
		}
	});
});

/**
 * Worker: Processa mensagens enfileiradas do webhook
 */
messageQueue.process('message-processing', async (job) => {
	return startSpan('queue.message.process', async (span) => {
		const { incomingMsg, providerName } = job.data;

		setAttributes({
			'queue.name': 'message-processing',
			'queue.job_id': String(job.id),
			'message.provider': providerName,
			'message.external_id': incomingMsg.externalId,
			'message.text_length': incomingMsg.text?.length || 0,
		});

		try {
			queueLogger.info(
				{ providerName, externalId: incomingMsg.externalId, jobId: job.id },
				'🚀 [Worker] Iniciando processamento de mensagem',
			);

			const { processMessage } = await import('./message-service');
			const provider = await getProvider(providerName);

			if (!provider) {
				throw new Error(`Provider ${providerName} não encontrado para o job`);
			}

			await processMessage(incomingMsg, provider);

			setAttributes({ 'queue.status': 'success' });
			queueLogger.info(
				{ providerName, externalId: incomingMsg.externalId, jobId: job.id },
				'✅ [Worker] Mensagem processada com sucesso',
			);
		} catch (error) {
			recordException(error as Error, { 'queue.status': 'failed' });
			queueLogger.error(
				{ providerName, externalId: incomingMsg.externalId, jobId: job.id, err: error },
				'❌ [Worker] Erro ao processar mensagem na fila',
			);
			throw error;
		}
	});
});

/**
 * Worker: Processa envio de respostas
 */
responseQueue.process('send-response', 5, async (job) => {
	return startSpan('queue.response.send', async (span) => {
		const { externalId, message, provider: providerName, metadata } = job.data;

		setAttributes({
			'queue.name': 'response-sending',
			'queue.job_id': String(job.id),
			'message.provider': providerName,
			'message.external_id': externalId,
			'message.length': message.length,
			'message.attempt': job.attemptsMade + 1,
			'conversation.id': metadata?.conversationId,
		});

		try {
			queueLogger.info(
				{
					externalId,
					provider: providerName,
					charCount: message.length,
					attempt: job.attemptsMade + 1,
					conversationId: metadata?.conversationId,
				},
				'📤 Enviando resposta (via queue)',
			);

			const providerInstance = await getProvider(providerName);
			if (!providerInstance) {
				throw new Error(`Provider ${providerName} não encontrado`);
			}

			await providerInstance.sendMessage(externalId, message);

			setAttributes({ 'queue.status': 'sent' });
			queueLogger.info({ externalId, attempt: job.attemptsMade + 1 }, '✅ Resposta enviada com sucesso');
			return { success: true };
		} catch (error: any) {
			recordException(error as Error, { 'queue.status': 'failed' });
			const isLastAttempt = job.attemptsMade >= (job.opts.attempts || 3) - 1;

			queueLogger.error(
				{
					externalId,
					provider: providerName,
					error: error.message,
					attempt: job.attemptsMade + 1,
					maxAttempts: job.opts.attempts,
					isLastAttempt,
				},
				'❌ Erro ao enviar resposta',
			);

			// Se erro de rede, deixa Bull retentar
			if (error.cause?.code === 'ETIMEDOUT' || error.cause?.code === 'ECONNREFUSED') {
				throw error; // Re-throw para Bull fazer retry
			}

			throw error;
		}
	});
});

/**
 * Worker: Processa enriquecimento em lote (Bulk Async Enrichment)
 */
enrichmentQueue.process('bulk-enrich-candidates', 2, async (job) => {
	return startSpan('queue.enrichment.process', async (span) => {
		const { candidates, provider, type } = job.data;

		setAttributes({
			'queue.name': 'enrichment-processing',
			'queue.job_id': String(job.id),
			'enrichment.provider': provider,
			'enrichment.type': type,
			'enrichment.candidates_count': candidates?.length || 0,
		});

		try {
			if (!candidates || candidates.length === 0) {
				setAttributes({ 'queue.status': 'no_candidates' });
				queueLogger.warn({ jobId: job.id }, '⚠️ Nenhum candidato recebido para enrichment');
				return { inserted: 0, skipped: 0, reason: 'no_candidates' };
			}

			queueLogger.info(
				{ provider, type, count: candidates.length, jobId: job.id },
				'🚀 [Worker] Iniciando bulk enrichment',
			);

			// 1. Extrair IDs
			const externalIds = candidates.map((c) => String(c.id));

			// 2. Verificar existentes
			const existingItems = await db
				.select({ externalId: semanticExternalItems.externalId })
				.from(semanticExternalItems)
				.where(
					and(
						eq(semanticExternalItems.provider, provider),
						eq(semanticExternalItems.type, type),
						inArray(semanticExternalItems.externalId, externalIds),
					),
				);

			const existingIds = new Set(existingItems.map((i) => i.externalId));

			// 3. Filtrar novos
			const newCandidates = candidates.filter((c) => !existingIds.has(String(c.id)));

			if (newCandidates.length === 0) {
				setAttributes({ 'queue.status': 'all_exist' });
				queueLogger.info({ jobId: job.id }, '✅ Todos os itens já existem no cache global');
				return { inserted: 0, skipped: candidates.length, reason: 'all_exist' };
			}

			setAttributes({ 'enrichment.new_candidates': newCandidates.length });
			queueLogger.info({ count: newCandidates.length }, '🔍 Novos itens para processar');

			// 4. Batch Vectorize (Promises paralelas)
			// Prepara texto para embedding: "Title: <title>. Overview: <overview>"
			const itemsToInsert = await Promise.all(
				newCandidates.map(async (candidate) => {
					const text = `Title: ${candidate.title || candidate.name}\nOverview: ${candidate.overview || ''}`.trim();

					let embedding: number[] | null = null;
					try {
						embedding = await embeddingService.generateEmbedding(text);
					} catch (err) {
						queueLogger.error({ err, candidateId: candidate.id }, '⚠️ Falha ao gerar embedding (ignorando item)');
						return null;
					}

					return {
						externalId: String(candidate.id),
						type,
						provider,
						rawData: candidate,
						embedding,
					};
				}),
			);

			const validItems = itemsToInsert.filter((i): i is NonNullable<typeof i> => {
				if (!i || !i.embedding) return false;
				// Valida embedding: array, 384 dimensões, todos números válidos
				return (
					Array.isArray(i.embedding) &&
					i.embedding.length === 384 &&
					i.embedding.every((v) => typeof v === 'number' && !Number.isNaN(v))
				);
			});

			if (validItems.length === 0) {
				setAttributes({ 'queue.status': 'embedding_failed' });
				queueLogger.warn({ jobId: job.id }, '⚠️ Nenhum embedding gerado com sucesso');
				return { inserted: 0, skipped: candidates.length, reason: 'embedding_failed' };
			}

			// 5. Bulk Insert
			const insertResult = await db
				.insert(semanticExternalItems)
				.values(validItems)
				.returning({ id: semanticExternalItems.id });

			const insertedCount = insertResult.length;
			const skippedCount = candidates.length - insertedCount;

			setAttributes({
				'queue.status': 'completed',
				'enrichment.inserted': insertedCount,
				'enrichment.skipped': skippedCount,
			});
			queueLogger.info(
				{
					attempted: validItems.length,
					inserted: insertedCount,
					skipped: skippedCount,
					jobId: job.id,
				},
				'✅ Bulk enrichment concluído',
			);

			return {
				inserted: insertedCount,
				attempted: validItems.length,
				skipped: skippedCount,
				total: candidates.length,
			};
		} catch (error) {
			recordException(error as Error, { 'queue.status': 'error' });
			queueLogger.error({ err: error, jobId: job.id }, '❌ Erro no bulk enrichment');
			throw error;
		}
	});
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

		queueLogger.info(
			{ conversationId, closeAt: closeAt.toISOString() },
			'📅 Banco atualizado: conversa aguardando fechamento',
		);

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

/**
 * Helper para enfileirar resposta
 */
export async function queueResponse(data: ResponseJob): Promise<void> {
	await responseQueue.add('send-response', data, {
		attempts: 3,
		backoff: {
			type: 'exponential',
			delay: 2000, // 2s -> 4s -> 8s
		},
		removeOnComplete: 1000,
		removeOnFail: true,
	});
	queueLogger.info({ externalId: data.externalId, provider: data.provider }, '📨 Resposta enfileirada');
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGTERM', async () => {
	queueLogger.info('🛑 Recebido SIGTERM, fechando queues...');
	await Promise.all([
		closeConversationQueue.close(),
		messageQueue.close(),
		responseQueue.close(),
		enrichmentQueue.close(),
	]);
});

process.on('SIGINT', async () => {
	queueLogger.info('🛑 Recebido SIGINT, fechando queues...');
	await Promise.all([
		closeConversationQueue.close(),
		messageQueue.close(),
		responseQueue.close(),
		enrichmentQueue.close(),
	]);
});
