/**
 * Memory Search Service - OpenClaw Pattern
 *
 * Hybrid search combining vector similarity and keyword matching
 * Uses pgvector for semantic search and PostgreSQL FTS for keyword search
 */

import { db } from '@/db';
import { agentDailyLogs, memoryItems } from '@/db/schema';
import type { MemorySearchOptions, MemorySearchResult } from '@/types';
import { loggers } from '@/utils/logger';
import { and, desc, eq, sql } from 'drizzle-orm';

/**
 * Hybrid search configuration
 */
export interface HybridSearchConfig {
	vectorWeight: number; // Weight for vector similarity (0-1)
	textWeight: number; // Weight for keyword search (0-1)
	mergeStrategy: 'average' | 'weighted' | 'reciprocal_rank_fusion'; // How to combine scores
}

/**
 * Default hybrid search configuration
 */
const DEFAULT_CONFIG: HybridSearchConfig = {
	vectorWeight: 0.7, // 70% semantic
	textWeight: 0.3, // 30% keyword
	mergeStrategy: 'weighted',
};

/**
 * Get embedding for a query text
 * Integrates with the embedding service
 */
async function getEmbedding(text: string): Promise<number[]> {
	// Try to use the embedding service if available
	try {
		// Check if embedding service exists
		const { embeddingService } = await import('@/services/embedding/embedding.service');
		const embedding = await embeddingService.embed(text);
		return embedding;
	} catch (error) {
		loggers.memory.warn({ error }, '⚠️ Embedding service not available, using placeholder');

		// Placeholder: return a 384-dimensional vector (all zeros)
		// In production, this should never happen
		return new Array(384).fill(0);
	}
}

/**
 * Normalize scores to 0-1 range
 */
function normalizeScore(score: number, min: number, max: number): number {
	if (max === min) return 0.5;
	return (score - min) / (max - min);
}

/**
 * Calculate Reciprocal Rank Fusion (RRF) score
 * Combines rankings from multiple sources
 */
function reciprocalRankFusion(rank1: number, rank2: number, k = 60): number {
	const rrf1 = k / (k + rank1);
	const rrf2 = k / (k + rank2);
	return rrf1 + rrf2;
}

/**
 * Merge hybrid results from vector and keyword search
 * Supports multiple merge strategies
 */
function mergeHybridResults(params: {
	vector: any[];
	keyword: any[];
	config: HybridSearchConfig;
}): MemorySearchResult[] {
	const { vector, keyword, config } = params;
	const { vectorWeight, textWeight, mergeStrategy } = config;

	const merged = new Map<string, MemorySearchResult>();

	// Calculate min/max for normalization
	const vectorScores = vector.map((v) => v.cosine_similarity || 0);
	const keywordScores = keyword.map((k) => k.rank || 0);
	const vectorMin = Math.min(...vectorScores, 0);
	const vectorMax = Math.max(...vectorScores, 1);
	const keywordMin = Math.min(...keywordScores, 0);
	const keywordMax = Math.max(...keywordScores, 1);

	// Process vector results
	vector.forEach((item, _index) => {
		const normalizedScore = normalizeScore(item.cosine_similarity || 0, vectorMin, vectorMax);
		const score = mergeStrategy === 'weighted' ? normalizedScore * vectorWeight : normalizedScore;

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
	keyword.forEach((item, index) => {
		const existing = merged.get(item.id);
		const normalizedScore = normalizeScore(item.rank || 0, keywordMin, keywordMax);
		const keywordScore = mergeStrategy === 'weighted' ? normalizedScore * textWeight : normalizedScore;

		if (existing) {
			// Merge based on strategy
			if (mergeStrategy === 'average') {
				existing.score = (existing.score + keywordScore) / 2;
			} else if (mergeStrategy === 'weighted') {
				existing.score += keywordScore; // Add weighted scores
			} else if (mergeStrategy === 'reciprocal_rank_fusion') {
				// RRF doesn't use normalized scores
				const rrfScore = reciprocalRankFusion(vector.findIndex((v) => v.id === item.id) + 1, index + 1);
				existing.score = rrfScore;
			}
		} else {
			merged.set(item.id, {
				id: item.id,
				type: item.type,
				title: item.title,
				content: '',
				metadata: item.metadata,
				score: keywordScore,
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
export async function searchMemory(
	options: MemorySearchOptions & { config?: Partial<HybridSearchConfig> },
): Promise<MemorySearchResult[]> {
	const {
		query,
		userId,
		maxResults = 10,
		minScore = 0.3,
		types,
		includeDailyLogs: _includeDailyLogs = false,
		config: userConfig,
	} = options;

	// Merge user config with defaults
	const config: HybridSearchConfig = {
		...DEFAULT_CONFIG,
		...userConfig,
	};

	loggers.memory.info({ query, userId, maxResults, config }, '🔍 Searching memory with hybrid config');

	// If query is empty, just return recent items
	if (!query || query.trim().length === 0) {
		const recentItems = await db.query.memoryItems.findMany({
			where: eq(memoryItems.userId, userId),
			orderBy: [desc(memoryItems.createdAt)],
			limit: maxResults,
		});

		loggers.memory.info({ count: recentItems.length }, '✅ Returning recent items (empty query)');

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

	// Get query embedding for vector search
	const queryEmbedding = await getEmbedding(query);

	// 1. Vector search (semantic similarity) using pgvector
	const vectorResults = await db.execute(sql`
		SELECT
			id,
			type,
			title,
			metadata,
			1 - (embedding <=> ${queryEmbedding}::vector) AS cosine_similarity
		FROM memory_items
		WHERE user_id = ${userId}
			AND embedding IS NOT NULL
			${types ? sql`AND type = ANY(${types})` : sql``}
		ORDER BY embedding <=> ${queryEmbedding}::vector ASC
		LIMIT ${maxResults * 2}
	`);

	loggers.memory.debug({ vectorCount: vectorResults.rows.length }, '📊 Vector search complete');

	// 2. Keyword search (full-text search) using PostgreSQL FTS
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

	loggers.memory.debug({ keywordCount: keywordResults.rows.length }, '📝 Keyword search complete');

	// 3. Merge results (hybrid)
	const merged = mergeHybridResults({
		vector: vectorResults.rows,
		keyword: keywordResults.rows,
		config,
	});

	// 4. Filter by minimum score
	const filtered = merged.filter((r) => r.score >= minScore);

	// 5. Return top N
	const results = filtered.slice(0, maxResults);

	loggers.memory.info(
		{
			query,
			userId,
			resultsCount: results.length,
			vectorCount: vectorResults.rows.length,
			keywordCount: keywordResults.rows.length,
			config,
		},
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
 * Search daily logs with date filtering
 */
export async function searchDailyLogs(options: {
	userId: string;
	date?: string; // YYYY-MM-DD format
	query?: string;
}): Promise<any[]> {
	const { userId, date, query } = options;

	loggers.memory.info({ userId, date, query }, '📅 Searching daily logs');

	// Build where conditions
	const conditions = [eq(agentDailyLogs.userId, userId)];

	if (date) {
		conditions.push(eq(agentDailyLogs.logDate, date));
	}

	if (query) {
		// Use ILIKE for case-insensitive search
		conditions.push(sql`${agentDailyLogs.content} ILIKE ${`%${query}%`}`);
	}

	// Fetch logs
	const logs = await db.query.agentDailyLogs.findMany({
		where: and(...conditions),
		orderBy: [desc(agentDailyLogs.logDate), desc(agentDailyLogs.createdAt)],
		limit: 10,
	});

	loggers.memory.info({ userId, date, query, count: logs.length }, '✅ Daily logs search complete');

	return logs.map((log) => ({
		id: log.id,
		userId: log.userId,
		date: log.logDate,
		content: log.content,
		createdAt: log.createdAt,
	}));
}

/**
 * Create or update daily log entry
 */
export async function upsertDailyLog(options: {
	userId: string;
	date: string; // YYYY-MM-DD format
	content: string;
}): Promise<void> {
	const { userId, date, content } = options;

	const existing = await db.query.agentDailyLogs.findFirst({
		where: and(eq(agentDailyLogs.userId, userId), eq(agentDailyLogs.logDate, date)),
	});

	if (existing) {
		// Update existing log
		await db
			.update(agentDailyLogs)
			.set({
				content: `${existing.content}\n\n${content}`,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(agentDailyLogs.id, existing.id));

		loggers.memory.debug({ userId, date }, '📝 Daily log updated');
	} else {
		// Create new log
		await db.insert(agentDailyLogs).values({
			userId,
			logDate: date,
			content,
		});

		loggers.memory.debug({ userId, date }, '📝 Daily log created');
	}
}
