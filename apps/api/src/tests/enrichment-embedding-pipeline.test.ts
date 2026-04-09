import { describe, expect, it, vi } from 'vitest';

const { mockExecuteEmbeddingTask } = vi.hoisted(() => ({
	mockExecuteEmbeddingTask: vi.fn(),
}));

vi.mock('@nexo/api-core/services/ai/embedding-task', () => ({
	executeEmbeddingTask: mockExecuteEmbeddingTask,
}));

describe('buildEnrichmentEmbeddingItem', () => {
	it('retorna item pronto para insert quando embedding task conclui', async () => {
		mockExecuteEmbeddingTask.mockResolvedValue({
			embedding: [0.1, 0.2, 0.3],
			durationMs: 12,
			block: {
				type: 'internal_task',
				task: 'embedding_generation',
				async: true,
				status: 'completed',
				metadata: { source: 'enrichment_worker_candidate' },
			},
		});

		const { buildEnrichmentEmbeddingItem } = await import(
			'@nexo/api-core/services/enrichment/enrichment-embedding-pipeline'
		);

		const result = await buildEnrichmentEmbeddingItem({
			candidate: {
				id: 123,
				title: 'The Matrix',
				overview: 'A hacker discovers reality.',
			},
			provider: 'tmdb',
			type: 'movie',
			jobId: 'job-1',
		});

		expect(mockExecuteEmbeddingTask).toHaveBeenCalledWith(
			expect.objectContaining({
				source: 'enrichment_worker_candidate',
				async: true,
			}),
		);
		expect(result.item).toEqual(
			expect.objectContaining({
				externalId: '123',
				type: 'movie',
				provider: 'tmdb',
				embedding: [0.1, 0.2, 0.3],
			}),
		);
		expect(result.block.status).toBe('completed');
	});

	it('retorna item nulo quando embedding task falha', async () => {
		mockExecuteEmbeddingTask.mockResolvedValue({
			embedding: null,
			durationMs: 12,
			block: {
				type: 'internal_task',
				task: 'embedding_generation',
				async: true,
				status: 'failed',
				metadata: { source: 'enrichment_worker_candidate' },
				error: 'timeout',
			},
		});

		const { buildEnrichmentEmbeddingItem } = await import(
			'@nexo/api-core/services/enrichment/enrichment-embedding-pipeline'
		);

		const result = await buildEnrichmentEmbeddingItem({
			candidate: { id: 456, name: 'Video' },
			provider: 'youtube',
			type: 'video',
			jobId: 'job-2',
		});

		expect(result.item).toBeNull();
		expect(result.block.status).toBe('failed');
		expect(result.block.error).toContain('timeout');
	});
});
