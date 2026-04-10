import { type AdapterOutputQueueJob, isCanonicalOutgoingEnvelope } from '@nexo/api-core/adapters/messaging';
import { REDIS_BASE_OPTIONS } from '@nexo/api-core/config/redis';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { dispatchAdapterOutputJob } from '@/outgoing/adapter-output-dispatcher';

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

export function createAdapterOutputWorker(): Worker<AdapterOutputQueueJob> {
	const worker = new Worker<AdapterOutputQueueJob>(
		'adapter-output',
		async (job) => {
			if (!isCanonicalOutgoingEnvelope(job.data)) {
				throw new Error('Payload inválido na adapter-output queue');
			}

			const idempotencyAccepted = await registerIdempotencyKey(job.data.idempotencyKey);

			if (!idempotencyAccepted) {
				return;
			}

			await dispatchAdapterOutputJob(job.data);
		},
		{
			connection: REDIS_BASE_OPTIONS,
			concurrency: 5,
		},
	);

	worker.on('failed', async (job, error) => {
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
	});

	return worker;
}

export async function shutdownAdapterOutputRuntime(worker: Worker<AdapterOutputQueueJob>): Promise<void> {
	await Promise.all([worker.close(), adapterOutputDlqQueue.close(), idempotencyRedis.quit()]);
}
