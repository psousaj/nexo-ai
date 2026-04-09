import { executeEmbeddingTask } from '@/services/ai/embedding-task';
import type { RuntimeInternalTaskBlock } from '@/services/ai/runtime-contract';

export interface EnrichmentEmbeddingCandidate {
	id: number | string;
	title?: string;
	name?: string;
	overview?: string;
	[key: string]: any;
}

export interface EnrichmentEmbeddingItem {
	externalId: string;
	type: 'movie' | 'tv_show' | 'video';
	provider: 'tmdb' | 'youtube';
	rawData: EnrichmentEmbeddingCandidate;
	embedding: number[];
}

export interface EnrichmentEmbeddingResult {
	item: EnrichmentEmbeddingItem | null;
	block: RuntimeInternalTaskBlock;
}

export async function buildEnrichmentEmbeddingItem(params: {
	candidate: EnrichmentEmbeddingCandidate;
	provider: 'tmdb' | 'youtube';
	type: 'movie' | 'tv_show' | 'video';
	jobId?: string | number;
}): Promise<EnrichmentEmbeddingResult> {
	const { candidate, provider, type, jobId } = params;

	const text = `Title: ${candidate.title || candidate.name}\nOverview: ${candidate.overview || ''}`.trim();
	const embeddingTask = await executeEmbeddingTask({
		input: text,
		async: true,
		source: 'enrichment_worker_candidate',
		metadata: {
			candidateId: String(candidate.id),
			provider,
			type,
			jobId: jobId ? String(jobId) : undefined,
		},
	});

	if (!embeddingTask.embedding) {
		return {
			item: null,
			block: embeddingTask.block,
		};
	}

	return {
		item: {
			externalId: String(candidate.id),
			type,
			provider,
			rawData: candidate,
			embedding: embeddingTask.embedding,
		},
		block: embeddingTask.block,
	};
}