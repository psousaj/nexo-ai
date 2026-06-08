import {
	type AdapterOutputQueueJob,
	type IngestMessageQueueJob,
	type IngestMessageQueuePayload,
	type OutgoingMessageQueuePayload,
	type ProviderType,
	createCanonicalOutgoingEnvelope,
	getProvider,
	isCanonicalIncomingEnvelope,
	isCanonicalOutgoingEnvelope,
	isMessagingChannel,
} from '@/adapters/messaging';
import { env } from '@/config/env';
import { REDIS_BASE_OPTIONS } from '@/config/redis';
import { db } from '@/db';
import { conversations, semanticExternalItems } from '@/db/schema';
import { dispatchAdapterOutputJob } from '@/services/adapter-output-dispatcher';
import { embeddingService } from '@/services/ai/embedding-service';
import { globalErrorHandler } from '@/services/error/error.service';
import { dispatchOutgoingText } from '@/services/outgoing-dispatcher.service';
import { mapWithConcurrency } from '@/utils/concurrency';
import { loggers } from '@/utils/logger';
import { recordException, setAttributes, startSpan } from '@nexo/otel/tracing';
import { Queue, Worker } from 'bullmq';
import { and, eq, inArray, lte } from 'drizzle-orm';
import Redis from 'ioredis';

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
const EMBEDDING_MAX_CONCURRENCY = env.EMBEDDING_MAX_CONCURRENCY ?? 4;

function reportQueueError(
	error: unknown,
	params: {
		queue: string;
		provider?: string;
		state?: string;
		conversationId?: string;
		userId?: string;
		extra?: Record<string, any>;
	},
) {
	void globalErrorHandler.handle(error, {
		provider: params.provider || 'queue',
		state: params.state || 'queue_error',
		conversationId: params.conversationId,
		userId: params.userId,
		extra: {
			queue: params.queue,
			...params.extra,
		},
	});
}

function normalizeIngestQueueJobData(data: IngestMessageQueueJob): IngestMessageQueuePayload {
	if (isCanonicalIncomingEnvelope(data)) {
		return data.payload;
	}

	if (!isMessagingChannel(data.providerName)) {
		throw new Error(`Provider inválido no job de ingestão: ${String(data.providerName)}`);
	}

	return {
		incomingMsg: data.incomingMsg,
		providerName: data.providerName,
		providerApi: data.providerApi,
	};
}

// ============================================================================
// QUEUE SETUP
// ============================================================================

// Validação de variáveis obrigatórias
if (!env.REDIS_HOST || !env.REDIS_PASSWORD) {
	throw new Error('Redis não configurado: REDIS_HOST e REDIS_PASSWORD são obrigatórios');
}

queueLogger.info(
	{
		host: env.REDIS_HOST,
		port: env.REDIS_PORT,
		user: env.REDIS_USER,
		tls: env.REDIS_TLS,
	},
	'🔧 Configuração do Redis (BullMQ)',
);

/**
 * Queue para fechamento de conversas
 */
export const closeConversationQueue = new Queue<{ conversationId: string }>('close-conversation', {
	connection: REDIS_BASE_OPTIONS,
});

queueLogger.info('✅ Queue "close-conversation" criada');

/**
 * Queue para processamento de mensagens recebidas (Webhooks)
 */
export const messageQueue = new Queue<IngestMessageQueueJob>('message-processing', { connection: REDIS_BASE_OPTIONS });

queueLogger.info('✅ Queue "message-processing" criada');

/**
 * Queue para despacho de saída para adapters
 */
export const adapterOutputQueue = new Queue<AdapterOutputQueueJob>('adapter-output', {
	connection: REDIS_BASE_OPTIONS,
});

queueLogger.info('✅ Queue "adapter-output" criada');

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;
const idempotencyRedis = new Redis(REDIS_BASE_OPTIONS);

export interface AdapterOutputDlqJob {
	failedAt: string;
	providerName: AdapterOutputQueueJob['payload']['providerName'];
	externalId: string;
	idempotencyKey: string;
	attemptsMade: number;
	errorMessage: string;
	payload: AdapterOutputQueueJob;
}

export const adapterOutputDlqQueue = new Queue<AdapterOutputDlqJob>('adapter-output-dlq', {
	connection: REDIS_BASE_OPTIONS,
});

queueLogger.info('✅ Queue "adapter-output-dlq" criada');

/**
 * Queue para envio de respostas com retry automático
 */
export const responseQueue = new Queue<ResponseJob>('response-sending', {
	connection: REDIS_BASE_OPTIONS,
});

queueLogger.info('✅ Queue "response-sending" criada');

/**
 * Queue para enriquecimento de dados em background (Bulk Async Enrichment)
 */
export const enrichmentQueue = new Queue<EnrichmentJob>('enrichment-processing', { connection: REDIS_BASE_OPTIONS });

queueLogger.info('✅ Queue "enrichment-processing" criada');

queueLogger.info(`🎯 BullMQ configurado com sucesso (${env.REDIS_HOST})`);

// ============================================================================
// EVENT LISTENERS - Erros nas queues
// ============================================================================

closeConversationQueue.on('error', (error) => {
	queueLogger.error({ err: error }, '❌ [close-conversation] Erro na queue');
	reportQueueError(error, { queue: 'close-conversation' });
});

messageQueue.on('error', (error) => {
	queueLogger.error({ err: error }, '❌ [message-processing] Erro na queue');
	reportQueueError(error, { queue: 'message-processing' });
});

adapterOutputQueue.on('error', (error) => {
	queueLogger.error({ err: error }, '❌ [adapter-output] Erro na queue');
	reportQueueError(error, { queue: 'adapter-output' });
});

responseQueue.on('error', (error) => {
	queueLogger.error({ err: error }, '❌ [response-sending] Erro na queue');
	reportQueueError(error, { queue: 'response-sending' });
});

enrichmentQueue.on('error', (error) => {
	queueLogger.error({ err: error }, '❌ [enrichment-processing] Erro na queue');
	reportQueueError(error, { queue: 'enrichment-processing' });
});

// ============================================================================
// WORKERS - BullMQ processa jobs via Worker separado
// ============================================================================

/**
 * Worker: Processa fechamento de conversas
 */
export const closeConversationWorker = new Worker<{ conversationId: string }>(
	'close-conversation',
	async (job) => {
		return startSpan('queue.close_conversation.process', async (_span) => {
			const { conversationId } = job.data;

			setAttributes({
				'queue.name': 'close-conversation',
				'queue.job_id': String(job.id),
				'conversation.id': conversationId,
			});

			try {
				queueLogger.info({ conversationId }, '🔄 Processando fechamento');

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
				throw error;
			}
		});
	},
	{ connection: REDIS_BASE_OPTIONS },
);

closeConversationWorker.on('active', (job) => {
	queueLogger.debug({ jobId: job.id }, '🔄 [close-conversation] Job ativo');
});

closeConversationWorker.on('failed', (job, error) => {
	if (!job) return;
	queueLogger.error({ jobId: job.id, err: error }, '❌ [close-conversation] Job falhou');
	reportQueueError(error, {
		queue: 'close-conversation',
		state: 'background_job',
		conversationId: job.data.conversationId,
		extra: { jobId: job.id },
	});
});

/**
 * Worker: Processa mensagens enfileiradas do webhook
 */
export const messageWorker = new Worker<IngestMessageQueueJob>(
	'message-processing',
	async (job) => {
		return startSpan('queue.message.process', async (_span) => {
			const normalizedJob = normalizeIngestQueueJobData(job.data);
			const { incomingMsg, providerName } = normalizedJob;

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

				const maxAttempts = job.opts.attempts || 1;
				const isLastAttempt = job.attemptsMade >= maxAttempts - 1;

				await processMessage(incomingMsg, provider, {
					shouldNotifyUserOnProcessingError: isLastAttempt,
				});

				setAttributes({ 'queue.status': 'success' });
				queueLogger.info(
					{ providerName, externalId: incomingMsg.externalId, jobId: job.id },
					'✅ [Worker] Mensagem processada com sucesso',
				);
			} catch (error) {
				recordException(error as Error, { 'queue.status': 'failed' });
				queueLogger.error(
					{
						providerName,
						externalId: incomingMsg.externalId,
						jobId: job.id,
						err: error,
					},
					'❌ [Worker] Erro ao processar mensagem na fila',
				);

				reportQueueError(error, {
					queue: 'message-processing',
					provider: providerName,
					state: 'worker_processing_failed',
					extra: {
						jobId: job.id,
						externalId: incomingMsg.externalId,
					},
				});
				throw error;
			}
		});
	},
	{ connection: REDIS_BASE_OPTIONS },
);

messageWorker.on('active', (job) => {
	queueLogger.debug({ jobId: job.id }, '🔄 [message-processing] Job ativo');
});

messageWorker.on('failed', (job, error) => {
	if (!job) return;

	let normalizedJob: IngestMessageQueuePayload | null = null;
	try {
		normalizedJob = normalizeIngestQueueJobData(job.data);
	} catch (normalizationError) {
		queueLogger.error(
			{ err: normalizationError, jobId: job.id },
			'❌ [message-processing] Falha ao normalizar payload do job',
		);
	}

	queueLogger.error({ jobId: job.id, err: error }, '❌ [message-processing] Job falhou');

	const conversationId = (error as any).conversationId;
	const userId = (error as any).userId;

	reportQueueError(error, {
		queue: 'message-processing',
		provider: normalizedJob?.providerName,
		state: 'background_job',
		conversationId,
		userId,
		extra: {
			jobId: job.id,
			externalId: normalizedJob?.incomingMsg.externalId,
		},
	});
});

/**
 * Worker: Processa envio de respostas
 */
export const responseWorker = new Worker<ResponseJob>(
	'response-sending',
	async (job) => {
		return startSpan('queue.response.send', async (_span) => {
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

				await dispatchOutgoingText(
					{
						providerName: providerName as any,
						externalId,
						conversationId: metadata?.conversationId,
						userId: metadata?.userId,
					},
					message,
				);

				setAttributes({ 'queue.status': 'sent' });
				queueLogger.info({ externalId, attempt: job.attemptsMade + 1 }, '✅ Resposta enviada com sucesso');
				return { success: true };
			} catch (error: any) {
				recordException(error as Error, { 'queue.status': 'failed' });
				const isLastAttempt = job.attemptsMade >= (job.opts.attempts || 1) - 1;

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

				if (error.cause?.code === 'ETIMEDOUT' || error.cause?.code === 'ECONNREFUSED') {
					throw error;
				}

				throw error;
			}
		});
	},
	{ connection: REDIS_BASE_OPTIONS, concurrency: 2 },
);

responseWorker.on('active', (job) => {
	queueLogger.debug({ jobId: job.id }, '🔄 [response-sending] Job ativo');
});

responseWorker.on('failed', (job, error) => {
	if (!job) return;
	queueLogger.error(
		{
			jobId: job.id,
			externalId: job.data.externalId,
			error: error.message,
			attempts: job.attemptsMade,
		},
		'❌ [response-sending] Job falhou',
	);

	reportQueueError(error, {
		queue: 'response-sending',
		state: 'background_job',
		conversationId: job.data.metadata?.conversationId,
		userId: job.data.metadata?.userId,
		extra: {
			jobId: job.id,
			externalId: job.data.externalId,
			attempts: job.attemptsMade,
		},
	});
});

/**
 * Worker: Processa enriquecimento em lote (Bulk Async Enrichment)
 */
export const enrichmentWorker = new Worker<EnrichmentJob>(
	'enrichment-processing',
	async (job) => {
		return startSpan('queue.enrichment.process', async (_span) => {
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

				const externalIds = candidates.map((c) => String(c.id));

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

				const newCandidates = candidates.filter((c) => !existingIds.has(String(c.id)));

				if (newCandidates.length === 0) {
					setAttributes({ 'queue.status': 'all_exist' });
					queueLogger.info({ jobId: job.id }, '✅ Todos os itens já existem no cache global');
					return {
						inserted: 0,
						skipped: candidates.length,
						reason: 'all_exist',
					};
				}

				setAttributes({ 'enrichment.new_candidates': newCandidates.length });
				setAttributes({
					'enrichment.embedding_concurrency': EMBEDDING_MAX_CONCURRENCY,
				});
				queueLogger.info({ count: newCandidates.length }, '🔍 Novos itens para processar');

				// 4. Batch Vectorize (concorrência controlada)
				// Prepara texto para embedding: "Title: <title>. Overview: <overview>"
				const itemsToInsert = await mapWithConcurrency(newCandidates, EMBEDDING_MAX_CONCURRENCY, async (candidate) => {
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
				});

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
					return {
						inserted: 0,
						skipped: candidates.length,
						reason: 'embedding_failed',
					};
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
	},
	{ connection: REDIS_BASE_OPTIONS, concurrency: 2 },
);

enrichmentWorker.on('active', (job) => {
	queueLogger.debug({ jobId: job.id }, '🔄 [enrichment-processing] Job ativo');
});

enrichmentWorker.on('failed', (job, error) => {
	if (!job) return;

	queueLogger.error({ jobId: job.id, err: error }, '❌ [enrichment-processing] Job falhou');

	reportQueueError(error, {
		queue: 'enrichment-processing',
		state: 'background_job',
		extra: {
			jobId: job.id,
			type: job.data.type,
			providerName: job.data.provider,
			candidatesCount: job.data.candidates?.length || 0,
		},
	});
});

/**
 * Worker: Processa saída de adapters (mensagens outgoing)
 */
async function registerIdempotencyKey(key: string): Promise<boolean> {
	const response = await idempotencyRedis.set(
		`nexo:outgoing:idempotency:${key}`,
		'1',
		'EX',
		IDEMPOTENCY_TTL_SECONDS,
		'NX',
	);
	return response === 'OK';
}

export const adapterOutputWorker = new Worker<AdapterOutputQueueJob>(
	'adapter-output',
	async (job) => {
		return startSpan('queue.adapter_output.process', async (_span) => {
			setAttributes({
				'queue.name': 'adapter-output',
				'queue.job_id': String(job.id),
			});

			if (!isCanonicalOutgoingEnvelope(job.data)) {
				throw new Error('Payload inválido na adapter-output queue');
			}

			const idempotencyAccepted = await registerIdempotencyKey(job.data.idempotencyKey);
			if (!idempotencyAccepted) {
				queueLogger.warn('adapter-output duplicate idempotency key ignored', {
					jobId: job.id,
					idempotencyKey: job.data.idempotencyKey,
					externalId: job.data.payload.externalId,
				});
				return;
			}

			await dispatchAdapterOutputJob(job.data);
			setAttributes({ 'queue.status': 'dispatched' });
		});
	},
	{
		connection: REDIS_BASE_OPTIONS,
		concurrency: 5,
	},
);

adapterOutputWorker.on('active', (job) => {
	queueLogger.debug({ jobId: job.id }, '🔄 [adapter-output] Job ativo');
});

adapterOutputWorker.on('failed', async (job, error) => {
	if (!job || !isCanonicalOutgoingEnvelope(job.data)) {
		return;
	}

	await adapterOutputDlqQueue.add(
		'adapter-output-failed',
		{
			failedAt: new Date().toISOString(),
			providerName: job.data.payload.providerName,
			externalId: job.data.payload.externalId,
			idempotencyKey: job.data.idempotencyKey,
			attemptsMade: job.attemptsMade,
			errorMessage: error.message,
			payload: job.data,
		},
		{
			removeOnComplete: 1000,
			removeOnFail: false,
		},
	);

	queueLogger.error('adapter-output moved to DLQ', {
		jobId: job.id,
		idempotencyKey: job.data.idempotencyKey,
		externalId: job.data.payload.externalId,
		providerName: job.data.payload.providerName,
		attemptsMade: job.attemptsMade,
		error: error.message,
	});
});

// ============================================================================
// FUNÇÕES PÚBLICAS
// ============================================================================

/**
 * Agenda fechamento de conversa em 15 minutos
 */
export async function scheduleConversationClose(conversationId: string): Promise<void> {
	try {
		const closeAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
		const jobId = `close_${conversationId}`; // BullMQ nao aceita ':' em custom jobId

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
				delay: 15 * 60 * 1000,
				jobId,
				attempts: 3,
				backoff: { type: 'exponential', delay: 5000 },
				removeOnComplete: true,
			},
		);

		queueLogger.info({ jobId }, '✅ Job agendado');
	} catch (error) {
		queueLogger.error({ conversationId, err: error }, '❌ Erro ao agendar fechamento');
		throw error;
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
		throw error;
	}
}

/**
 * Cron de backup: fecha conversas que deveriam estar fechadas
 */
export async function runConversationCloseCron(): Promise<number> {
	try {
		const now = new Date();

		const result = await db.transaction(async (tx) => {
			const lockedRows = await tx
				.select({ id: conversations.id })
				.from(conversations)
				.where(and(eq(conversations.state, 'waiting_close'), lte(conversations.closeAt, now)))
				.for('update', { skipLocked: true });

			if (lockedRows.length === 0) {
				return [];
			}

			const lockedIds = lockedRows.map((r) => r.id);

			return tx
				.update(conversations)
				.set({
					state: 'closed',
					closeAt: null,
					closeJobId: null,
					updatedAt: now,
				})
				.where(inArray(conversations.id, lockedIds))
				.returning({ id: conversations.id });
		});

		const count = result.length;

		if (count > 0) {
			queueLogger.info({ count }, '⏰ CRON: Conversas expiradas fechadas');
		}

		return count;
	} catch (error: any) {
		if (error?.message?.includes('column') || error?.message?.includes('does not exist')) {
			queueLogger.error({ err: error }, '❌ CRON: Schema mismatch — verifique se migration foi aplicada');
		} else {
			queueLogger.error({ err: error }, '❌ Erro no cron de fechamento');
		}
		throw error;
	}
}

/**
 * Cron de timeout para awaiting_confirmation
 */
export async function runAwaitingConfirmationTimeoutCron(): Promise<number> {
	try {
		const now = new Date();
		const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

		const result = await db.transaction(async (tx) => {
			const lockedRows = await tx
				.select({ id: conversations.id })
				.from(conversations)
				.where(and(eq(conversations.state, 'awaiting_confirmation'), lte(conversations.updatedAt, thirtyMinutesAgo)))
				.for('update', { skipLocked: true });

			if (lockedRows.length === 0) {
				return [];
			}

			const lockedIds = lockedRows.map((r) => r.id);

			return tx
				.update(conversations)
				.set({
					state: 'closed',
					closeAt: null,
					closeJobId: null,
					context: null,
					updatedAt: now,
				})
				.where(inArray(conversations.id, lockedIds))
				.returning({ id: conversations.id });
		});

		const count = result.length;

		if (count > 0) {
			queueLogger.info({ count }, '⏰ CRON: Conversas em awaiting_confirmation expiradas fechadas');
		}

		return count;
	} catch (error: any) {
		if (error?.message?.includes('column') || error?.message?.includes('does not exist')) {
			queueLogger.error({ err: error }, '❌ CRON: Schema mismatch — verifique se migration foi aplicada');
		} else {
			queueLogger.error({ err: error }, '❌ Erro no timeout de awaiting_confirmation');
		}
		throw error;
	}
}

/**
 * Helper para enfileirar resposta
 */
export async function queueResponse(data: ResponseJob): Promise<void> {
	await responseQueue.add('send-response', data, {
		attempts: 1,
		removeOnComplete: 1000,
		removeOnFail: true,
	});
	queueLogger.info({ externalId: data.externalId, provider: data.provider }, '📨 Resposta enfileirada');
}

/**
 * Helper para enfileirar saída canônica para o app bots
 */
export async function queueAdapterOutput(
	payload: OutgoingMessageQueuePayload,
	options?: {
		traceId?: string;
		idempotencyKey?: string;
		attempts?: number;
		removeOnComplete?: number | boolean;
		removeOnFail?: number | boolean;
	},
): Promise<void> {
	const job = createCanonicalOutgoingEnvelope({
		payload,
		traceId: options?.traceId,
		idempotencyKey: options?.idempotencyKey,
	});

	await adapterOutputQueue.add('dispatch-outgoing', job, {
		attempts: options?.attempts ?? 3,
		backoff: { type: 'exponential', delay: 1500 },
		removeOnComplete: options?.removeOnComplete ?? 1000,
		removeOnFail: options?.removeOnFail ?? false,
	});

	queueLogger.info(
		{
			provider: payload.providerName,
			externalId: payload.externalId,
			deliveryMethod: payload.deliveryMethod,
		},
		'📤 Saída canônica enfileirada para adapter-output',
	);
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

export async function shutdownQueues() {
	await Promise.all([
		closeConversationWorker.close(),
		messageWorker.close(),
		responseWorker.close(),
		enrichmentWorker.close(),
		adapterOutputWorker.close(),
		closeConversationQueue.close(),
		messageQueue.close(),
		adapterOutputQueue.close(),
		adapterOutputDlqQueue.close(),
		responseQueue.close(),
		enrichmentQueue.close(),
		idempotencyRedis.quit(),
	]);
}
