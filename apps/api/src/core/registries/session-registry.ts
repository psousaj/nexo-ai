import { db } from '@/db';
import { agentSessions } from '@/db/schema/agent-sessions';
import { and, eq, isNull } from 'drizzle-orm';

export interface SessionRegistry {
	load(sessionKey: string): Promise<unknown>;
	save(sessionKey: string, patch: Record<string, unknown>): Promise<void>;
}

export function resolveSessionKey(provider: string, externalId: string): string {
	const peerKind = externalId.startsWith('-') ? 'group' : 'direct';
	return `agent:main:${provider}:${peerKind}:${externalId}`;
}

/**
 * Follow the session chain to find the active (non-ended) session.
 * NEX-73: supports context compression session splits.
 */
export async function resolveActiveSessionKey(sessionKey: string): Promise<string> {
	const registry = new PostgresSessionRegistry();
	const session = (await registry.load(sessionKey)) as any;
	if (!session?.parentSessionId) return sessionKey;

	// Load parent session record to get its key
	const parent = (await db
		.select()
		.from(agentSessions)
		.where(eq(agentSessions.id, session.parentSessionId))
		.limit(1)) as any[];
	if (!parent?.[0]?.sessionKey) return sessionKey;

	return resolveActiveSessionKey(parent[0].sessionKey);
}

export class PostgresSessionRegistry implements SessionRegistry {
	async load(sessionKey: string) {
		// Find the most recent active (non-ended) session for this key
		const [session] = await db
			.select()
			.from(agentSessions)
			.where(and(eq(agentSessions.sessionKey, sessionKey), isNull(agentSessions.endedAt)))
			.orderBy(agentSessions.createdAt)
			.limit(1);
		return session ?? null;
	}

	async save(sessionKey: string, patch: Record<string, unknown>) {
		const exists = await this.load(sessionKey);
		if (exists) {
			await db
				.update(agentSessions)
				.set({ ...patch, updatedAt: new Date() } as any)
				.where(eq(agentSessions.id, (exists as any).id));
		} else {
			await db.insert(agentSessions).values({
				sessionKey,
				channel: (patch.channel as string) ?? 'unknown',
				peerKind: (patch.peerKind as string) ?? 'direct',
				peerId: (patch.peerId as string) ?? sessionKey,
				...(patch as any),
			});
		}
	}
}
