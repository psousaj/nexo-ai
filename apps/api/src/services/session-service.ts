/**
 * Session Service - OpenClaw-style Session Keys
 *
 * Implements hierarchical session key format:
 * agent:{agentId}:{channel}:{peerKind}:{peerId}
 *
 * Examples:
 * - agent:main:telegram:direct:+1234567890
 * - agent:main:discord:guild:123456789:channel:987654321
 * - agent:main:whatsapp:direct:user123
 * - agent:main:web:direct:session-uuid
 */

import { db } from '@/db';
import { agentSessions } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { loggers } from '@/utils/logger';

/**
 * Parameters to build a session key
 */
export interface SessionKeyParams {
	/** Agent identifier (default: 'main') */
	agentId?: string;
	/** Channel: telegram, discord, whatsapp, web */
	channel: string;
	/** Account ID for multi-account support */
	accountId?: string;
	/** Peer kind: direct, group, channel */
	peerKind: 'direct' | 'group' | 'channel';
	/** Peer ID: userId, groupId, channelId */
	peerId: string;
	/** Isolation scope for DMs */
	dmScope?: 'main' | 'per-peer' | 'per-channel-peer' | 'per-account-channel-peer';
}

/**
 * Parsed session key components
 */
export interface SessionKeyParts {
	agentId: string;
	channel: string;
	accountId?: string;
	peerKind: string;
	peerId: string;
	dmScope?: string;
}

/**
 * Session record from database
 */
export interface AgentSession {
	id: string;
	sessionKey: string;
	agentId: string;
	channel: string;
	accountId: string | null;
	peerKind: string;
	peerId: string;
	userId: string | null;
	conversationId: string | null;
	model: string | null;
	thinkingLevel: string | null;
	createdAt: string;
	updatedAt: string;
	lastActivityAt: string;
	dmScope: string;
}

/**
 * Build a session key from components
 * Format: agent:{agentId}:{channel}:{accountId}:{peerKind}:{peerId}
 */
export function buildSessionKey(params: SessionKeyParams): string {
	const agentId = params.agentId || 'main';
	const parts = ['agent', agentId, params.channel];

	if (params.accountId) {
		parts.push(params.accountId);
	}

	parts.push(params.peerKind, params.peerId);

	return parts.join(':');
}

/**
 * Parse a session key into components
 */
export function parseSessionKey(sessionKey: string): SessionKeyParts {
	const parts = sessionKey.split(':');

	if (parts.length < 5 || parts[0] !== 'agent') {
		throw new Error(`Invalid session key format: ${sessionKey}`);
	}

	const result: SessionKeyParts = {
		agentId: parts[1],
		channel: parts[2],
		peerKind: parts[parts.length - 2],
		peerId: parts[parts.length - 1],
	};

	// Check if there's an accountId (between channel and peerKind)
	if (parts.length === 7) {
		result.accountId = parts[3];
	}

	return result;
}

/**
 * Find or create a session record
 */
export async function getOrCreateSession(params: SessionKeyParams): Promise<AgentSession> {
	const sessionKey = buildSessionKey(params);

	loggers.session.info({ sessionKey }, '🔑 Looking up session');

	// Try to find existing session
	const existing = await db.query.agentSessions.findFirst({
		where: eq(agentSessions.sessionKey, sessionKey),
	});

	if (existing) {
		// Update last activity
		await db
			.update(agentSessions)
			.set({
				updatedAt: new Date().toISOString(),
				lastActivityAt: new Date().toISOString(),
			})
			.where(eq(agentSessions.id, existing.id));

		loggers.session.info({ sessionId: existing.id }, '✅ Session found');
		return existing as AgentSession;
	}

	// Create new session
	const dmScope = params.dmScope || 'per-peer';
	const newSession = await db
		.insert(agentSessions)
		.values({
			sessionKey,
			agentId: params.agentId || 'main',
			channel: params.channel,
			accountId: params.accountId || null,
			peerKind: params.peerKind,
			peerId: params.peerId,
			dmScope,
		})
		.returning()
		.then((rows) => rows[0]);

	loggers.session.info({ sessionId: newSession.id, sessionKey }, '✨ New session created');

	return newSession as AgentSession;
}

/**
 * Link a session to a user and conversation
 */
export async function linkSessionToUser(
	sessionKey: string,
	userId: string,
	conversationId: string,
): Promise<void> {
	await db
		.update(agentSessions)
		.set({
			userId,
			conversationId,
			updatedAt: new Date().toISOString(),
		})
		.where(eq(agentSessions.sessionKey, sessionKey));

	loggers.session.info({ sessionKey, userId, conversationId }, '🔗 Session linked to user');
}

/**
 * Update session metadata
 */
export async function updateSessionMetadata(
	sessionKey: string,
	metadata: {
		model?: string;
		thinkingLevel?: string;
	},
): Promise<void> {
	await db
		.update(agentSessions)
		.set({
			...metadata,
			updatedAt: new Date().toISOString(),
		})
		.where(eq(agentSessions.sessionKey, sessionKey));
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(userId: string): Promise<AgentSession[]> {
	const sessions = await db.query.agentSessions.findMany({
		where: eq(agentSessions.userId, userId),
		orderBy: [desc(agentSessions.lastActivityAt)],
	});

	return sessions as AgentSession[];
}

/**
 * Get active session for a specific channel and peer
 */
export async function getActiveSession(channel: string, peerKind: string, peerId: string): Promise<AgentSession | null> {
	const session = await db.query.agentSessions.findFirst({
		where: and(
			eq(agentSessions.channel, channel),
			eq(agentSessions.peerKind, peerKind),
			eq(agentSessions.peerId, peerId),
		),
		orderBy: [desc(agentSessions.lastActivityAt)],
	});

	return session as AgentSession | null;
}

/**
 * Delete a session
 */
export async function deleteSession(sessionKey: string): Promise<void> {
	await db.delete(agentSessions).where(eq(agentSessions.sessionKey, sessionKey));
	loggers.session.info({ sessionKey }, '🗑️ Session deleted');
}

/**
 * Clean up old sessions (older than 30 days)
 */
export async function cleanupOldSessions(daysOld: number = 30): Promise<number> {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - daysOld);

	const result = await db
		.delete(agentSessions)
		.where(eq(agentSessions.lastActivityAt, cutoffDate.toISOString()))
		.returning({ id: agentSessions.id });

	loggers.session.info({ count: result.length, daysOld }, '🧹 Old sessions cleaned up');

	return result.length;
}
