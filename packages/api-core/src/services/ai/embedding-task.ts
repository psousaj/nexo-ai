import { captureException } from '@/sentry';
import { loggers } from '@/utils/logger';
import { embeddingService } from './embedding-service';
import type { RuntimeInternalTaskBlock } from './runtime-contract';

export interface EmbeddingTaskRequest {
	input: string;
	async: boolean;
	source: string;
	metadata?: Record<string, unknown>;
}

export interface EmbeddingTaskResult {
	embedding: number[] | null;
	block: RuntimeInternalTaskBlock;
	durationMs: number;
}

export async function executeEmbeddingTask(request: EmbeddingTaskRequest): Promise<EmbeddingTaskResult> {
	const start = performance.now();

	try {
		const embedding = await embeddingService.generateEmbedding(request.input);
		const durationMs = Math.round(performance.now() - start);

		return {
			embedding,
			durationMs,
			block: {
				type: 'internal_task',
				task: 'embedding_generation',
				async: request.async,
				status: 'completed',
				metadata: {
					source: request.source,
					durationMs,
					dimensions: embedding.length,
					...(request.metadata ?? {}),
				},
			},
		};
	} catch (error) {
		const durationMs = Math.round(performance.now() - start);
		const errorMessage = error instanceof Error ? error.message : String(error);

		captureException(error instanceof Error ? error : new Error(String(error)), {
			provider: 'embedding',
			state: 'embedding_task',
			source: request.source,
			async: request.async,
			duration_ms: durationMs,
			...(request.metadata ?? {}),
		});

		loggers.enrichment.warn(
			{
				err: error,
				source: request.source,
				async: request.async,
				durationMs,
			},
			'⚠️ Embedding task falhou',
		);

		return {
			embedding: null,
			durationMs,
			block: {
				type: 'internal_task',
				task: 'embedding_generation',
				async: request.async,
				status: 'failed',
				metadata: {
					source: request.source,
					durationMs,
					...(request.metadata ?? {}),
				},
				error: errorMessage,
			},
		};
	}
}