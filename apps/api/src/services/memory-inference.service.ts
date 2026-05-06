/**
 * Memory Inference Service — NEX-22
 *
 * Proactive memory inference pipeline that generates derived insights
 * from raw memory items. Two triggers:
 *
 * 1. REACTIVE: After N memories of the same type/pattern, generate insight
 * 2. PROACTIVE: At conversation start, analyze context and suggest insights
 *
 * Architecture:
 * ┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
 * │  Raw Memory  │────▶│  Inference Engine │────▶│  Derived    │
 * │  (save_memory)│     │  (rules + LLM)   │     │  (insights) │
 * └─────────────┘     └──────────────────┘     └─────────────┘
 *                           │
 *                           ▼
 *                    ┌──────────────┐
 *                    │  Proactive    │
 *                    │  Suggestion   │
 *                    └──────────────┘
 */

import { db } from '@/db';
import { memoryInsights, memoryItems } from '@/db/schema';
import { loggers } from '@/utils/logger';
import { and, desc, eq, gte, sql } from 'drizzle-orm';

// ============================================================================
// CONFIGURATION
// ============================================================================

const INFERENCE_CONFIG = {
	/** Minimum memories of same cognitive_type to trigger pattern inference */
	minPatternCount: 3,
	/** Maximum proactive suggestions per conversation */
	maxProactiveSuggestions: 2,
	/** Minimum confidence for an insight to be surfaced */
	minConfidence: 0.6,
	/** Time window (days) to look for patterns */
	patternWindowDays: 30,
	/** Cooldown (hours) before re-suggesting the same insight */
	suggestionCooldownHours: 24,
};

// ============================================================================
// TYPES
// ============================================================================

export interface InferenceResult {
	insightType: 'pattern' | 'preference' | 'fact_inferred' | 'behavior';
	content: string;
	summary?: string;
	confidence: number;
	importance: number;
	derivedFrom: string[];
}

export interface ProactiveSuggestion {
	insightId: string;
	content: string;
	summary: string;
	confidence: number;
	insightType: string;
}

// ============================================================================
// REACTIVE INFERENCE — Triggered after new memory is saved
// ============================================================================

/**
 * Analyze recent memories and generate insights when patterns emerge.
 * Call this after saving a new memory item.
 */
export async function runReactiveInference(userId: string): Promise<InferenceResult[]> {
	loggers.memory.info({ userId }, '🧠 Running reactive inference');

	const results: InferenceResult[] = [];

	// 1. Check for cognitive type clustering (e.g., 3+ "event" memories → pattern)
	const typeClusters = await detectTypeClusters(userId);
	results.push(...typeClusters);

	// 2. Check for preference emergence (e.g., multiple items of same genre/category)
	const preferences = await detectPreferencePatterns(userId);
	results.push(...preferences);

	// 3. Check for behavioral patterns (e.g., recurring topics)
	const behaviors = await detectBehavioralPatterns(userId);
	results.push(...behaviors);

	// Save insights to DB
	for (const result of results) {
		await saveInsight(userId, result);
	}

	loggers.memory.info({ userId, insightsGenerated: results.length }, '✅ Reactive inference complete');
	return results;
}

/**
 * Detect when user has multiple memories of the same cognitive type,
 * suggesting a recurring pattern.
 */
async function detectTypeClusters(userId: string): Promise<InferenceResult[]> {
	const results: InferenceResult[] = [];
	const windowDate = new Date(Date.now() - INFERENCE_CONFIG.patternWindowDays * 24 * 60 * 60 * 1000);

	// Count memories by cognitive_type in the window
	const typeCounts = await db
		.select({
			cognitiveType: memoryItems.cognitiveType,
			count: sql<number>`count(*)::int`,
		})
		.from(memoryItems)
		.where(and(eq(memoryItems.userId, userId), gte(memoryItems.createdAt, windowDate)))
		.groupBy(memoryItems.cognitiveType);

	for (const row of typeCounts) {
		if (row.count >= INFERENCE_CONFIG.minPatternCount && row.cognitiveType !== 'note') {
			// Check if we already have this insight
			const existing = await db.query.memoryInsights.findFirst({
				where: and(
					eq(memoryInsights.userId, userId),
					eq(memoryInsights.insightType, 'pattern'),
					sql`${memoryInsights.content} LIKE ${`%${row.cognitiveType}%`}`,
				),
			});

			if (!existing) {
				results.push({
					insightType: 'pattern',
					content: `Usuário acumula ${row.count} memórias do tipo "${row.cognitiveType}" nos últimos ${INFERENCE_CONFIG.patternWindowDays} dias`,
					summary: `Padrão: ${row.count}x ${row.cognitiveType}`,
					confidence: Math.min(0.9, 0.5 + row.count * 0.1),
					importance: 0.6,
					derivedFrom: [], // Would need to track source IDs
				});
			}
		}
	}

	return results;
}

/**
 * Detect preference patterns from metadata (e.g., genres, categories).
 */
async function detectPreferencePatterns(userId: string): Promise<InferenceResult[]> {
	const results: InferenceResult[] = [];
	const windowDate = new Date(Date.now() - INFERENCE_CONFIG.patternWindowDays * 24 * 60 * 60 * 1000);

	// Find items with genre/category metadata and count occurrences
	const genreCounts = await db.execute(sql`
		SELECT
			${sql`metadata->>'genre'`} AS genre,
			count(*)::int AS count
		FROM memory_items
		WHERE user_id = ${userId}
			AND created_at >= ${windowDate}
			AND metadata->>'genre' IS NOT NULL
		GROUP BY ${sql`metadata->>'genre'`}
		HAVING count(*) >= ${INFERENCE_CONFIG.minPatternCount}
		ORDER BY count DESC
		LIMIT 5
	`);

	for (const row of genreCounts as any[]) {
		if (row.genre && row.count >= INFERENCE_CONFIG.minPatternCount) {
			const existing = await db.query.memoryInsights.findFirst({
				where: and(
					eq(memoryInsights.userId, userId),
					eq(memoryInsights.insightType, 'preference'),
					sql`${memoryInsights.content} LIKE ${`%${row.genre}%`}`,
				),
			});

			if (!existing) {
				results.push({
					insightType: 'preference',
					content: `Usuário parece gostar de "${row.genre}" (${row.count} itens)`,
					summary: `Preferência: ${row.genre}`,
					confidence: Math.min(0.85, 0.4 + row.count * 0.1),
					importance: 0.7,
					derivedFrom: [],
				});
			}
		}
	}

	return results;
}

/**
 * Detect behavioral patterns from memory titles and metadata.
 */
async function detectBehavioralPatterns(_userId: string): Promise<InferenceResult[]> {
	// Behavioral patterns require more sophisticated analysis
	// For now, return empty — can be enhanced with LLM calls
	return [];
}

// ============================================================================
// PROACTIVE SUGGESTIONS — Triggered at conversation start
// ============================================================================

/**
 * Generate proactive suggestions based on recent context.
 * Call this at the beginning of a conversation.
 */
export async function getProactiveSuggestions(userId: string): Promise<ProactiveSuggestion[]> {
	loggers.memory.info({ userId }, '🔮 Generating proactive suggestions');

	// 1. Get recent unsurfaced insights
	const recentInsights = await db.query.memoryInsights.findMany({
		where: and(
			eq(memoryInsights.userId, userId),
			gte(memoryInsights.confidence, INFERENCE_CONFIG.minConfidence),
			sql`${memoryInsights.lastAccessedAt} IS NULL OR ${memoryInsights.lastAccessedAt} < ${new Date(Date.now() - INFERENCE_CONFIG.suggestionCooldownHours * 60 * 60 * 1000)}`,
		),
		orderBy: [desc(memoryInsights.confidence), desc(memoryInsights.importance)],
		limit: INFERENCE_CONFIG.maxProactiveSuggestions,
	});

	// 2. Update lastAccessedAt for surfaced insights
	for (const insight of recentInsights) {
		await db.update(memoryInsights).set({ lastAccessedAt: new Date() }).where(eq(memoryInsights.id, insight.id));
	}

	const suggestions: ProactiveSuggestion[] = recentInsights.map((insight) => ({
		insightId: insight.id,
		content: insight.content,
		summary: insight.summary || insight.content.slice(0, 100),
		confidence: insight.confidence,
		insightType: insight.insightType,
	}));

	loggers.memory.info({ userId, count: suggestions.length }, '✅ Proactive suggestions ready');
	return suggestions;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Save an inference result as a memory insight.
 */
async function saveInsight(userId: string, result: InferenceResult): Promise<void> {
	try {
		await db.insert(memoryInsights).values({
			userId,
			insightType: result.insightType,
			content: result.content,
			summary: result.summary,
			confidence: result.confidence,
			importance: result.importance,
			derivedFrom: result.derivedFrom.length > 0 ? result.derivedFrom : null,
			source: 'inference',
		});

		loggers.memory.debug(
			{ userId, insightType: result.insightType, confidence: result.confidence },
			'💾 Insight saved',
		);
	} catch (error) {
		loggers.memory.error({ userId, error }, '❌ Failed to save insight');
	}
}

/**
 * Mark an insight as superseded by a newer version.
 */
export async function supersedeInsight(oldInsightId: string, newInsightId: string): Promise<void> {
	await db
		.update(memoryInsights)
		.set({
			supersededBy: newInsightId,
			updatedAt: new Date(),
		})
		.where(eq(memoryInsights.id, oldInsightId));
}
