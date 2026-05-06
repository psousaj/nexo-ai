/**
 * Context Builder - OpenClaw Pattern Implementation
 *
 * Builds dynamic system prompts by loading user profiles and injecting context
 * similar to how OpenClaw loads .md files (AGENTS.md, SOUL.md, IDENTITY.md, etc.)
 *
 * This enables per-user personalization while maintaining NEXO's deterministic
 * runtime control (ADR-011).
 *
 * NEX-25: System prompt snapshots are cached per session key to protect
 * API prefix cache and reduce token costs. Cache is invalidated when:
 * - Profile changes (soul, identity, agents, user, tools, memory content)
 * - Memory is written (memory_items or memory_insights insert/update)
 * - Session is restarted
 */

import { db } from '@/db';
import { agentMemoryProfiles, memoryInsights, memoryItems, users } from '@/db/schema';
import { loggers } from '@/utils/logger';
import { and, desc, eq, gte } from 'drizzle-orm';

// ============================================================================
// PROMPT CACHE (NEX-25)
// ============================================================================

interface CachedPrompt {
	systemPrompt: string;
	context: AgentContext;
	createdAt: number;
}

const PROMPT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes safety net
const promptCache = new Map<string, CachedPrompt>();

/**
 * Generate a cache key from userId + sessionKey.
 */
function getCacheKey(userId: string, sessionKey: string): string {
	return `${userId}:${sessionKey}`;
}

/**
 * Check if a cached prompt is still valid.
 */
function isCacheValid(entry: CachedPrompt): boolean {
	return Date.now() - entry.createdAt < PROMPT_CACHE_TTL_MS;
}

/**
 * Invalidate cache for a user (called when profile or memory changes).
 */
export function invalidatePromptCache(userId: string): void {
	const prefix = `${userId}:`;
	for (const key of promptCache.keys()) {
		if (key.startsWith(prefix)) {
			promptCache.delete(key);
		}
	}
	loggers.context.debug({ userId }, '🗑️ Prompt cache invalidated');
}

/**
 * Agent context built from user profile
 */
export interface AgentContext {
	/** Complete system prompt with all sections */
	systemPrompt: string;
	/** Individual sections for fine-grained control */
	agentsContent?: string;
	soulContent?: string;
	identityContent?: string;
	userContent?: string;
	toolsContent?: string;
	memoryContent?: string;
	/** Structured memory entries (NEX-23) */
	structuredMemory?: string;
	/** Assistant personality fields */
	assistantName?: string;
	assistantEmoji?: string;
	assistantCreature?: string;
	assistantTone?: string;
	assistantVibe?: string;
}

// ============================================================================
// MEMORY CONTENT STRUCTURING (NEX-23)
// ============================================================================

const MEMORY_CONTENT_MAX_CHARS = 2200;
const MEMORY_ENTRY_SEPARATOR = '§';

/**
 * Build structured memory content from memory_items and memory_insights.
 * Orders by importance/confidence, limits to 2200 chars, uses § separator.
 *
 * Format: § [type:confidence] content
 */
export async function buildStructuredMemory(userId: string): Promise<string> {
	// 1. Fetch recent memory items ordered by importance
	const items = await db.query.memoryItems.findMany({
		where: eq(memoryItems.userId, userId),
		orderBy: [desc(memoryItems.importance), desc(memoryItems.createdAt)],
		limit: 50,
	});

	// 2. Fetch high-confidence insights
	const insights = await db.query.memoryInsights.findMany({
		where: and(eq(memoryInsights.userId, userId), gte(memoryInsights.confidence, 0.6)),
		orderBy: [desc(memoryInsights.confidence), desc(memoryInsights.importance)],
		limit: 20,
	});

	// 3. Format entries
	const entries: string[] = [];

	for (const item of items) {
		const confidence = item.confidence ?? 1.0;
		const entry = `${MEMORY_ENTRY_SEPARATOR} [${item.cognitiveType}:${confidence.toFixed(1)}] ${item.title}`;
		entries.push(entry);
	}

	for (const insight of insights) {
		const entry = `${MEMORY_ENTRY_SEPARATOR} [insight:${insight.confidence.toFixed(1)}] ${insight.summary || insight.content}`;
		entries.push(entry);
	}

	// 4. Join and truncate to max chars
	let result = entries.join('\n');
	if (result.length > MEMORY_CONTENT_MAX_CHARS) {
		result = result.slice(0, MEMORY_CONTENT_MAX_CHARS);
		// Truncate at last complete entry
		const lastSeparator = result.lastIndexOf(MEMORY_ENTRY_SEPARATOR);
		if (lastSeparator > 0) {
			result = result.slice(0, lastSeparator);
		}
	}

	return result;
}

/**
 * Build agent context for a user and session
 *
 * Loads profile data and constructs a personalized system prompt
 * following OpenClaw's pattern of injecting .md file contents.
 *
 * NEX-25: Results are cached per session key to protect API prefix cache.
 */
export async function buildAgentContext(userId: string, sessionKey: string): Promise<AgentContext> {
	// Check cache first (NEX-25)
	const cacheKey = getCacheKey(userId, sessionKey);
	const cached = promptCache.get(cacheKey);
	if (cached && isCacheValid(cached)) {
		loggers.context.debug({ userId, sessionKey }, '📋 Using cached prompt snapshot');
		return cached.context;
	}

	loggers.context.info({ userId, sessionKey }, '🔨 Building agent context');

	// Parse session key to determine session type
	const isDirectMessage = sessionKey.includes(':direct:');
	const isMainSession = sessionKey.includes(':main:');

	// Load user profile (personality settings)
	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
	});

	if (!user) {
		loggers.context.warn({ userId }, '⚠️ User not found, using default context');
		return getDefaultContext();
	}

	// Load agent memory profile (if exists)
	const profile = await db.query.agentMemoryProfiles.findFirst({
		where: eq(agentMemoryProfiles.userId, userId),
	});

	// Build system prompt sections
	const sections: string[] = [];

	// 1. Base identity (always included)
	const assistantName = user.assistantName || 'NEXO';
	sections.push(`You are ${assistantName}, a personal AI assistant.`);

	// 2. SOUL.md equivalent - personality (if present)
	if (profile?.soulContent) {
		sections.push(`\n## Personality\n${profile.soulContent}`);
	} else if (user.assistantTone) {
		// Fallback to tone field
		sections.push(`\n## Personality\nTone: ${user.assistantTone}`);
		if (user.assistantVibe) {
			sections.push(`Vibe: ${user.assistantVibe}`);
		}
	}

	// 3. IDENTITY.md equivalent - name, emoji, creature (if present)
	const identityParts: string[] = [];
	if (profile?.identityContent) {
		identityParts.push(profile.identityContent);
	} else {
		identityParts.push(`Name: ${assistantName}`);
		if (user.assistantEmoji) {
			identityParts.push(`Emoji: ${user.assistantEmoji}`);
		}
		if (user.assistantCreature) {
			identityParts.push(`Creature: ${user.assistantCreature}`);
		}
	}
	if (identityParts.length > 0) {
		sections.push(`\n## Identity\n${identityParts.join('\n')}`);
	}

	// 4. AGENTS.md equivalent - workspace instructions (if present)
	if (profile?.agentsContent) {
		sections.push(`\n## Instructions\n${profile.agentsContent}`);
	}

	// 5. USER.md equivalent - user profile (ONLY in DMs, not in groups)
	// This respects privacy by not sharing user info in group chats
	if (isDirectMessage && profile?.userContent) {
		sections.push(`\n## User Profile\n${profile.userContent}`);
	}

	// 6. MEMORY.md equivalent - long-term memory (ONLY in main session)
	// Prevents context pollution in secondary sessions
	if (isMainSession) {
		// Use structured memory from memory_items + memory_insights (NEX-23)
		const structuredMemory = await buildStructuredMemory(userId);
		if (structuredMemory) {
			sections.push(`\n## Long-term Memory\n${structuredMemory}`);
		} else if (profile?.memoryContent) {
			// Fallback to legacy memoryContent if no structured data
			sections.push(`\n## Long-term Memory\n${profile.memoryContent}`);
		}
	}

	// 7. Tools documentation (if present)
	if (profile?.toolsContent) {
		sections.push(`\n## Available Tools\n${profile.toolsContent}`);
	}

	const systemPrompt = sections.join('\n');

	loggers.context.info(
		{
			userId,
			hasSoul: !!profile?.soulContent,
			hasIdentity: !!profile?.identityContent,
			hasUser: !!profile?.userContent,
			hasMemory: !!profile?.memoryContent,
			promptLength: systemPrompt.length,
		},
		'✅ Agent context built',
	);

	const result: AgentContext = {
		systemPrompt,
		agentsContent: profile?.agentsContent ?? undefined,
		soulContent: profile?.soulContent ?? undefined,
		identityContent: profile?.identityContent ?? undefined,
		userContent: profile?.userContent ?? undefined,
		toolsContent: profile?.toolsContent ?? undefined,
		memoryContent: profile?.memoryContent ?? undefined,
		assistantName: user.assistantName || undefined,
		assistantEmoji: user.assistantEmoji || undefined,
		assistantCreature: user.assistantCreature || undefined,
		assistantTone: user.assistantTone || undefined,
		assistantVibe: user.assistantVibe || undefined,
	};

	// Store in cache (NEX-25)
	promptCache.set(cacheKey, {
		systemPrompt,
		context: result,
		createdAt: Date.now(),
	});

	return result;
}

/**
 * Get default context when user is not found
 */
function getDefaultContext(): AgentContext {
	return {
		systemPrompt: 'You are NEXO, a personal AI assistant.',
		assistantName: 'NEXO',
		soulContent: undefined,
		identityContent: undefined,
		agentsContent: undefined,
		userContent: undefined,
		toolsContent: undefined,
		memoryContent: undefined,
	};
}

/**
 * Update or create user profile
 */
export async function updateAgentProfile(
	userId: string,
	profile: Partial<{
		agentsContent: string;
		soulContent: string;
		identityContent: string;
		userContent: string;
		toolsContent: string;
		memoryContent: string;
	}>,
): Promise<void> {
	const existing = await db.query.agentMemoryProfiles.findFirst({
		where: eq(agentMemoryProfiles.userId, userId),
	});

	if (existing) {
		await db
			.update(agentMemoryProfiles)
			.set({
				...profile,
				updatedAt: new Date(),
			})
			.where(eq(agentMemoryProfiles.id, existing.id));
	} else {
		await db.insert(agentMemoryProfiles).values({
			userId,
			...profile,
		});
	}

	// Invalidate prompt cache (NEX-25)
	invalidatePromptCache(userId);

	loggers.context.info({ userId }, '✏️ Agent profile updated');
}

/**
 * Get agent profile for a user
 */
export async function getAgentProfile(userId: string): Promise<AgentContext | null> {
	const profile = await db.query.agentMemoryProfiles.findFirst({
		where: eq(agentMemoryProfiles.userId, userId),
	});

	if (!profile) {
		return null;
	}

	return {
		systemPrompt: '', // Caller should build if needed
		agentsContent: profile.agentsContent || undefined,
		soulContent: profile.soulContent || undefined,
		identityContent: profile.identityContent || undefined,
		userContent: profile.userContent || undefined,
		toolsContent: profile.toolsContent || undefined,
		memoryContent: profile.memoryContent || undefined,
	};
}

/**
 * Helper: Format personality as natural language description
 */
export function formatPersonalityDescription(context: AgentContext): string {
	const parts: string[] = [];

	if (context.assistantName) {
		parts.push(`I'm ${context.assistantName}`);
	}

	if (context.assistantEmoji) {
		parts.push(`${context.assistantEmoji}`);
	}

	if (context.assistantCreature) {
		parts.push(`your friendly ${context.assistantCreature}`);
	}

	if (context.assistantTone) {
		parts.push(`with a ${context.assistantTone} tone`);
	}

	if (context.assistantVibe) {
		parts.push(`and a ${context.assistantVibe} vibe`);
	}

	return parts.join(' ') || "I'm your AI assistant";
}
