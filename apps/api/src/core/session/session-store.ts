import { db } from '@/db';
import { agentSessions } from '@/db/schema/agent-sessions';
import { and, eq, isNull } from 'drizzle-orm';
import type { SessionRegistry } from '../registries/session-registry';

export type { SessionRegistry };

export interface SessionResetPolicy {
	mode: 'daily' | 'idle' | 'both' | 'none';
	atHour: number;
	idleMinutes: number;
	notify: boolean;
}

export interface SessionEntry {
	id: string;
	sessionKey: string;
	channel: string;
	peerKind: string;
	peerId: string;
	userId?: string;
	startedAt: Date;
	endedAt?: Date;
	resetReason?: string;
	parentSessionId?: string;
	lastActivityAt: Date;
}

const RESET_NOTIFICATIONS: Record<string, string> = {
	idle: '⚠️ Sessão anterior expirou (inativo por {hours}h). Iniciando nova conversa.\n\n',
	daily: '⚠️ Nova sessão iniciada (reset diário).\n\n',
	compression: '⚠️ Sessão anterior foi comprimida por limite de contexto. Iniciando nova conversa.\n\n',
	manual: '⚠️ Sessão anterior foi encerrada manualmente. Iniciando nova conversa.\n\n',
};

const NO_NOTIFICATION_CHANNELS = new Set(['api_server', 'webhook']);

export class SessionStore {
	constructor(
		private deps: {
			sessionRegistry: SessionRegistry;
			hasActiveProcesses?: (sessionKey: string) => boolean;
		},
	) {}

	getResetPolicy(peerKind: string): SessionResetPolicy {
		switch (peerKind) {
			case 'direct':
				return { mode: 'idle', atHour: 4, idleMinutes: 1440, notify: true };
			case 'group':
				return { mode: 'daily', atHour: 4, idleMinutes: 1440, notify: true };
			case 'thread':
				return { mode: 'idle', atHour: 4, idleMinutes: 720, notify: true };
			default:
				return { mode: 'both', atHour: 4, idleMinutes: 1440, notify: true };
		}
	}

	isSessionExpired(entry: SessionEntry, policy: SessionResetPolicy): boolean {
		if (policy.mode === 'none') return false;
		if (this.deps.hasActiveProcesses?.(entry.sessionKey)) return false;

		const now = new Date();
		const lastActivity = entry.lastActivityAt;

		if (policy.mode === 'idle' || policy.mode === 'both') {
			const idleMs = policy.idleMinutes * 60 * 1000;
			if (now.getTime() - lastActivity.getTime() > idleMs) {
				return true;
			}
		}

		if (policy.mode === 'daily' || policy.mode === 'both') {
			const todayAtHour = new Date(now);
			todayAtHour.setHours(policy.atHour, 0, 0, 0);
			if (lastActivity.getTime() < todayAtHour.getTime()) {
				return true;
			}
		}

		return false;
	}

	async getOrCreateSession(
		sessionKey: string,
		defaults: { channel: string; peerKind: string; peerId: string; userId?: string },
	): Promise<{ session: SessionEntry; wasReset: boolean; resetReason?: string }> {
		const row = await this.deps.sessionRegistry.load(sessionKey);

		if (row && !(row as SessionEntry).endedAt) {
			const entry = row as SessionEntry;
			const policy = this.getResetPolicy(entry.peerKind);

			if (this.isSessionExpired(entry, policy)) {
				const reason = this.determineExpiryReason(entry, policy);
				const newSession = await this.resetSession(sessionKey, reason);
				return { session: newSession, wasReset: true, resetReason: reason };
			}

			return { session: entry, wasReset: false };
		}

		// Create new session - use registry save which will insert a new row
		await this.deps.sessionRegistry.save(sessionKey, {
			...defaults,
			startedAt: new Date(),
			lastActivityAt: new Date(),
		});

		const created = await this.deps.sessionRegistry.load(sessionKey);
		return { session: created as SessionEntry, wasReset: false };
	}

	async resetSession(sessionKey: string, reason: 'idle' | 'daily' | 'compression' | 'manual'): Promise<SessionEntry> {
		const now = new Date();

		// Mark current active session as ended
		const activeSessions = await db
			.select()
			.from(agentSessions)
			.where(and(eq(agentSessions.sessionKey, sessionKey), isNull(agentSessions.endedAt)))
			.orderBy(agentSessions.createdAt)
			.limit(1);

		let parentId: string | undefined;
		if (activeSessions.length > 0) {
			parentId = activeSessions[0].id;
			await db.update(agentSessions).set({ endedAt: now, resetReason: reason }).where(eq(agentSessions.id, parentId));
		}

		// Load defaults from most recent session (ended or not)
		const [mostRecent] = await db
			.select()
			.from(agentSessions)
			.where(eq(agentSessions.sessionKey, sessionKey))
			.orderBy(agentSessions.createdAt)
			.limit(1);

		const defaults = mostRecent
			? {
					channel: mostRecent.channel,
					peerKind: mostRecent.peerKind,
					peerId: mostRecent.peerId,
					userId: mostRecent.userId ?? undefined,
				}
			: { channel: 'unknown', peerKind: 'direct', peerId: sessionKey };

		// Insert new session row via registry (no active session exists now, so it will insert)
		await this.deps.sessionRegistry.save(sessionKey, {
			...defaults,
			startedAt: now,
			lastActivityAt: now,
			parentSessionId: parentId,
		});

		const created = await this.deps.sessionRegistry.load(sessionKey);
		return created as SessionEntry;
	}

	async touchSession(sessionKey: string): Promise<void> {
		await db
			.update(agentSessions)
			.set({ lastActivityAt: new Date(), updatedAt: new Date() })
			.where(and(eq(agentSessions.sessionKey, sessionKey), isNull(agentSessions.endedAt)));
	}

	getResetNotification(reason: string, channel: string, idleMinutes?: number): string | undefined {
		if (NO_NOTIFICATION_CHANNELS.has(channel)) return undefined;

		let template = RESET_NOTIFICATIONS[reason];
		if (!template) return undefined;

		if (reason === 'idle' && idleMinutes) {
			template = template.replace('{hours}', String(Math.round(idleMinutes / 60)));
		}

		return template;
	}

	private determineExpiryReason(entry: SessionEntry, policy: SessionResetPolicy): 'idle' | 'daily' {
		const now = new Date();
		const lastActivity = entry.lastActivityAt;

		let idleExpired = false;
		let dailyExpired = false;

		if (policy.mode === 'idle' || policy.mode === 'both') {
			const idleMs = policy.idleMinutes * 60 * 1000;
			idleExpired = now.getTime() - lastActivity.getTime() > idleMs;
		}

		if (policy.mode === 'daily' || policy.mode === 'both') {
			const todayAtHour = new Date(now);
			todayAtHour.setHours(policy.atHour, 0, 0, 0);
			dailyExpired = lastActivity.getTime() < todayAtHour.getTime();
		}

		return idleExpired ? 'idle' : 'daily';
	}
}
