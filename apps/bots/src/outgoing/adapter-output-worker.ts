import { type AdapterOutputQueueJob, isCanonicalOutgoingEnvelope } from '@nexo/api-core/adapters/messaging';
import { REDIS_BASE_OPTIONS } from '@nexo/api-core/config/redis';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { dispatchAdapterOutputJob } from '@/outgoing/adapter-output-dispatcher';

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;
const SNAPSHOT_COUNT_KEYS = ['waiting', 'active', 'delayed', 'completed', 'failed', 'paused'] as const;
const idempotencyRedis = new Redis(REDIS_BASE_OPTIONS);

type SnapshotCountKey = (typeof SNAPSHOT_COUNT_KEYS)[number];

export interface AdapterOutputQueueCounts {
	waiting: number;
	active: number;
	delayed: number;
	completed: number;
	failed: number;
	paused: number;
}

export interface AdapterOutputQueuesSnapshot {
	main: AdapterOutputQueueCounts;
	dlq: AdapterOutputQueueCounts;
}

export const adapterOutputQueue = new Queue<AdapterOutputQueueJob>('adapter-output', {
	connection: REDIS_BASE_OPTIONS,
});

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

function normalizeJobCounts(rawCounts: Partial<Record<SnapshotCountKey, number>>): AdapterOutputQueueCounts {
	return {
		waiting: rawCounts.waiting ?? 0,
		active: rawCounts.active ?? 0,
		delayed: rawCounts.delayed ?? 0,
		completed: rawCounts.completed ?? 0,
		failed: rawCounts.failed ?? 0,
		paused: rawCounts.paused ?? 0,
	};
}

export async function getAdapterOutputQueueSnapshot(): Promise<AdapterOutputQueuesSnapshot> {
	const [mainCounts, dlqCounts] = await Promise.all([
		adapterOutputQueue.getJobCounts(...SNAPSHOT_COUNT_KEYS),
		adapterOutputDlqQueue.getJobCounts(...SNAPSHOT_COUNT_KEYS),
	]);

	return {
		main: normalizeJobCounts(mainCounts),
		dlq: normalizeJobCounts(dlqCounts),
	};
}

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
				console.warn('adapter-output duplicate idempotency key ignored', {
					jobId: job.id,
					idempotencyKey: job.data.idempotencyKey,
					externalId: job.data.payload.externalId,
				});
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

		console.error('adapter-output moved to DLQ', {
			jobId: job.id,
			idempotencyKey: job.data.idempotencyKey,
			externalId: job.data.payload.externalId,
			providerName: job.data.payload.providerName,
			attemptsMade: job.attemptsMade,
			error: error.message,
		});
	});

	return worker;
}

export async function shutdownAdapterOutputRuntime(worker: Worker<AdapterOutputQueueJob>): Promise<void> {
	await Promise.all([
		worker.close(),
		adapterOutputQueue.close(),
		adapterOutputDlqQueue.close(),
		idempotencyRedis.quit(),
	]);
}
