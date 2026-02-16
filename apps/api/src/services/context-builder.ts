/**
 * Context Builder - OpenClaw Pattern Implementation
 *
 * Builds dynamic system prompts by loading user profiles and injecting context
 * similar to how OpenClaw loads .md files (AGENTS.md, SOUL.md, IDENTITY.md, etc.)
 *
 * This enables per-user personalization while maintaining NEXO's deterministic
 * runtime control (ADR-011).
 */

import { db } from '@/db';
import { agentMemoryProfiles, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { loggers } from '@/utils/logger';

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
	/** Assistant personality fields */
	assistantName?: string;
	assistantEmoji?: string;
	assistantCreature?: string;
	assistantTone?: string;
	assistantVibe?: string;
}

/**
 * Build agent context for a user and session
 *
 * Loads profile data and constructs a personalized system prompt
 * following OpenClaw's pattern of injecting .md file contents.
 */
export async function buildAgentContext(userId: string, sessionKey: string): Promise<AgentContext> {
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
	if (isMainSession && profile?.memoryContent) {
		sections.push(`\n## Long-term Memory\n${profile.memoryContent}`);
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

	return {
		systemPrompt,
		agentsContent: profile?.agentsContent,
		soulContent: profile?.soulContent,
		identityContent: profile?.identityContent,
		userContent: profile?.userContent,
		toolsContent: profile?.toolsContent,
		memoryContent: profile?.memoryContent,
		assistantName: user.assistantName || undefined,
		assistantEmoji: user.assistantEmoji || undefined,
		assistantCreature: user.assistantCreature || undefined,
		assistantTone: user.assistantTone || undefined,
		assistantVibe: user.assistantVibe || undefined,
	};
}

/**
 * Get default context when user is not found
 */
function getDefaultContext(): AgentContext {
	return {
		systemPrompt: 'You are NEXO, a personal AI assistant.',
		assistantName: 'NEXO',
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
				updatedAt: new Date().toISOString(),
			})
			.where(eq(agentMemoryProfiles.id, existing.id));
	} else {
		await db.insert(agentMemoryProfiles).values({
			userId,
			...profile,
		});
	}

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
