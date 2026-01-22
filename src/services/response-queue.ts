import { Queue, Worker, type Job } from 'bullmq';
import { redis } from '@/config/redis';
import { loggers } from '@/utils/logger';
import { getMessagingProvider, type ProviderType } from '@/adapters/messaging';

/**
 * Response Queue Job Interface
 */
export interface ResponseJob {
	externalId: string;
	message: string;
	provider: ProviderType;
	metadata?: {
		conversationId: string;
		userId: string;
		attempt?: number;
	};
}

/**
 * Queue para envio de respostas com retry automático
 *
 * Benefícios:
 * - Retry automático (3 tentativas com exponential backoff)
 * - Persistência no Redis (mensagens não se perdem)
 * - Ordem mantida (FIFO)
 * - Não bloqueia processamento principal
 */
export const responseQueue = new Queue<ResponseJob>('response-sending', {
	connection: redis,
	defaultJobOptions: {
		attempts: 3,
		backoff: {
			type: 'exponential',
			delay: 2000, // 2s → 4s → 8s
		},
		removeOnComplete: {
			age: 3600, // Remove após 1h
			count: 1000, // Mantém últimas 1000
		},
		removeOnFail: {
			age: 86400, // Remove após 24h
		},
	},
});

/**
 * Worker que processa envio de respostas
 */
export const responseWorker = new Worker<ResponseJob>(
	'response-sending',
	async (job: Job<ResponseJob>) => {
		const { externalId, message, provider, metadata } = job.data;

		try {
			loggers.webhook.info(
				{
					externalId,
					provider,
					charCount: message.length,
					attempt: job.attemptsMade + 1,
					conversationId: metadata?.conversationId,
				},
				'📤 Enviando resposta (via queue)',
			);

			const providerInstance = getMessagingProvider(provider);
			await providerInstance.sendMessage(externalId, message);

			loggers.webhook.info({ externalId, attempt: job.attemptsMade + 1 }, '✅ Resposta enviada com sucesso');

			return { success: true, sent: true };
		} catch (error: any) {
			const isLastAttempt = job.attemptsMade >= (job.opts.attempts || 3) - 1;

			loggers.webhook.error(
				{
					externalId,
					provider,
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

			// Para outros erros, também retenta
			throw error;
		}
	},
	{
		connection: redis,
		concurrency: 5, // Processa até 5 mensagens simultaneamente
	},
);

/**
 * Helper para enfileirar resposta
 */
export async function queueResponse(data: ResponseJob): Promise<void> {
	await responseQueue.add('send-response', data);
	loggers.webhook.info({ externalId: data.externalId, provider: data.provider }, '📨 Resposta enfileirada');
}

/**
 * Listeners para monitoramento
 */
responseWorker.on('completed', (job) => {
	loggers.queue.info({ jobId: job.id, externalId: job.data.externalId }, '✅ [Response Queue] Job concluído');
});

responseWorker.on('failed', (job, error) => {
	if (job) {
		loggers.queue.error(
			{
				jobId: job.id,
				externalId: job.data.externalId,
				error: error.message,
				attempts: job.attemptsMade,
			},
			'❌ [Response Queue] Job falhou definitivamente',
		);
	}
});

responseWorker.on('error', (error) => {
	loggers.queue.error({ error: error.message }, '❌ [Response Queue] Worker error');
});

loggers.queue.info('✅ Response Queue configurado');
