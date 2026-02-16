/**
 * Memory Search Service - OpenClaw Pattern
 *
 * Hybrid search combining vector similarity and keyword matching
 * Uses pgvector for semantic search and PostgreSQL FTS for keyword search
 */

import { db } from '@/db';
import { memoryItems } from '@/db/schema';
import { sql, eq, or, and, desc } from 'drizzle-orm';
import { loggers } from '@/utils/logger';
import type { MemorySearchOptions, MemorySearchResult } from '@/types';

/**
 * Get embedding for a query text
 * TODO: Integrate with actual embedding service
 */
async function getEmbedding(text: string): Promise<number[]> {
	// For now, return a placeholder
	// In production, this would call the embedding service
	// For example: return await embeddingService.embed(text);

	// Placeholder: return a 384-dimensional vector (all zeros)
	return new Array(384).fill(0);
}

/**
 * Merge hybrid results from vector and keyword search
 */
function mergeHybridResults(params: {
	vector: any[];
	keyword: any[];
	vectorWeight: number;
	textWeight: number;
}): MemorySearchResult[] {
	const { vector, keyword, vectorWeight, textWeight } = params;

	const merged = new Map<string, MemorySearchResult>();

	// Add vector results
	vector.forEach((item) => {
		const score = item.cosine_similarity * vectorWeight;
		merged.set(item.id, {
			id: item.id,
			type: item.type,
			title: item.title,
			content: '', // Content not loaded in vector search
			metadata: item.metadata,
			score,
			source: 'memory',
		});
	});

	// Add/merge keyword results
	keyword.forEach((item) => {
		const existing = merged.get(item.id);
		const score = (item.rank || 0) * textWeight * 0.1; // Scale rank to 0-1 range

		if (existing) {
			// Combine scores (average)
			existing.score = (existing.score + score) / 2;
		} else {
			merged.set(item.id, {
				id: item.id,
				type: item.type,
				title: item.title,
				content: '',
				metadata: item.metadata,
				score,
				source: 'memory',
			});
		}
	});

	// Convert to array and sort by score
	return Array.from(merged.values()).sort((a, b) => b.score - a.score);
}

/**
 * Search memory items using hybrid search (vector + keyword)
 */
export async function searchMemory(options: MemorySearchOptions): Promise<MemorySearchResult[]> {
	const {
		query,
		userId,
		maxResults = 10,
		minScore = 0.3,
		types,
		includeDailyLogs = false,
	} = options;

	loggers.memory.info({ query, userId, maxResults }, '🔍 Searching memory');

	// If query is empty, just return recent items
	if (!query || query.trim().length === 0) {
		const recentItems = await db.query.memoryItems.findMany({
			where: eq(memoryItems.userId, userId),
			orderBy: [desc(memoryItems.createdAt)],
			limit: maxResults,
		});

		return recentItems.map((item) => ({
			id: item.id,
			type: item.type,
			title: item.title,
			content: '', // Content not stored in memory_items table
			metadata: item.metadata,
			score: 1.0, // Recent items get max score
			source: 'memory' as const,
		}));
	}

	// 1. Vector search (semantic similarity)
	const vectorResults = await db.execute(sql`
		SELECT
			id,
			type,
			title,
			metadata,
			1 - (embedding <=> ${getEmbedding(query)}) AS cosine_similarity
		FROM memory_items
		WHERE user_id = ${userId}
			AND embedding IS NOT NULL
			${types ? sql`AND type = ANY(${types})` : sql``}
		ORDER BY embedding <=> ${getEmbedding(query)} ASC
		LIMIT ${maxResults * 2}
	`);

	// 2. Keyword search (full-text search)
	const keywordResults = await db.execute(sql`
		SELECT
			id,
			type,
			title,
			metadata,
			ts_rank(to_tsvector('portuguese', title || ' ' || COALESCE(metadata::text, '')), plainto_tsquery('portuguese', ${query})) AS rank
		FROM memory_items
		WHERE user_id = ${userId}
			AND to_tsvector('portuguese', title || ' ' || COALESCE(metadata::text, '')) @@ plainto_tsquery('portuguese', ${query})
			${types ? sql`AND type = ANY(${types})` : sql``}
		ORDER BY rank DESC
		LIMIT ${maxResults * 2}
	`);

	// 3. Merge results (hybrid)
	const merged = mergeHybridResults({
		vector: vectorResults.rows,
		keyword: keywordResults.rows,
		vectorWeight: 0.7, // 70% semantic, 30% keyword
		textWeight: 0.3,
	});

	// 4. Filter by minimum score
	const filtered = merged.filter((r) => r.score >= minScore);

	// 5. Return top N
	const results = filtered.slice(0, maxResults);

	loggers.memory.info(
		{ query, userId, resultsCount: results.length, vectorCount: vectorResults.rows.length, keywordCount: keywordResults.rows.length },
		'✅ Memory search complete',
	);

	return results;
}

/**
 * Get specific memory item by ID
 */
export async function getMemoryItem(id: string, userId: string): Promise<MemorySearchResult | null> {
	const item = await db.query.memoryItems.findFirst({
		where: and(eq(memoryItems.id, id), eq(memoryItems.userId, userId)),
	});

	if (!item) {
		return null;
	}

	return {
		id: item.id,
		type: item.type,
		title: item.title,
		content: '', // Content not stored in memory_items table
		metadata: item.metadata,
		score: 1.0,
		source: 'memory',
	};
}

/**
 * Search daily logs (for future implementation)
 */
export async function searchDailyLogs(options: {
	userId: string;
	date?: string; // YYYY-MM-DD format
	query?: string;
}): Promise<any[]> {
	// TODO: Implement daily log search
	// This will be implemented when agent_daily_logs table is populated
	loggers.memory.warn({ userId }, '⚠️ Daily log search not yet implemented');
	return [];
}
