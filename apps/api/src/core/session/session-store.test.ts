import { describe, expect, it, vi } from 'vitest';

// Mock db before importing session-store
vi.mock('@/db', () => ({
	db: {
		update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) })),
		select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve([])) })) })) })) })),
		'delete': vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
		insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
	},
}));

vi.mock('@/db/schema/agent-sessions', () => ({
	agentSessions: {
		id: 'id',
		sessionKey: 'session_key',
		endedAt: 'ended_at',
		resetReason: 'reset_reason',
		createdAt: 'created_at',
		lastActivityAt: 'last_activity_at',
		updatedAt: 'updated_at',
	},
}));

import { SessionStore, type SessionEntry, type SessionRegistry } from './session-store';

function createMockRegistry(sessions: SessionEntry[] = []): SessionRegistry {
	return {
		load: vi.fn(async (key: string) => {
			const active = sessions
				.filter((s) => s.sessionKey === key && !s.endedAt)
				.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
			return active[0] ?? null;
		}),
		save: vi.fn(async (key: string, patch: Record<string, unknown>) => {
			const existing = sessions.find((s) => s.sessionKey === key && !s.endedAt);
			if (existing) {
				Object.assign(existing, patch);
			} else {
				sessions.push({
					id: `id-${Date.now()}-${Math.random().toString(36).slice(2)}`,
					sessionKey: key,
					channel: (patch.channel as string) ?? 'unknown',
					peerKind: (patch.peerKind as string) ?? 'direct',
					peerId: (patch.peerId as string) ?? key,
					userId: patch.userId as string | undefined,
					startedAt: (patch.startedAt as Date) ?? new Date(),
					lastActivityAt: (patch.lastActivityAt as Date) ?? new Date(),
					endedAt: patch.endedAt as Date | undefined,
					resetReason: patch.resetReason as string | undefined,
					parentSessionId: patch.parentSessionId as string | undefined,
				});
			}
		}),
	};
}

describe('SessionStore', () => {
	describe('getResetPolicy', () => {
		it('should return idle policy for direct messages', () => {
			const store = new SessionStore({ sessionRegistry: createMockRegistry() });
			const policy = store.getResetPolicy('direct');
			expect(policy.mode).toBe('idle');
			expect(policy.idleMinutes).toBe(1440);
		});

		it('should return daily policy for groups', () => {
			const store = new SessionStore({ sessionRegistry: createMockRegistry() });
			const policy = store.getResetPolicy('group');
			expect(policy.mode).toBe('daily');
			expect(policy.atHour).toBe(4);
		});

		it('should return idle policy with 12h for threads', () => {
			const store = new SessionStore({ sessionRegistry: createMockRegistry() });
			const policy = store.getResetPolicy('thread');
			expect(policy.mode).toBe('idle');
			expect(policy.idleMinutes).toBe(720);
		});

		it('should return both policy as default', () => {
			const store = new SessionStore({ sessionRegistry: createMockRegistry() });
			const policy = store.getResetPolicy('unknown');
			expect(policy.mode).toBe('both');
			expect(policy.idleMinutes).toBe(1440);
			expect(policy.atHour).toBe(4);
		});
	});

	describe('isSessionExpired', () => {
		it('should return false for none mode', () => {
			const store = new SessionStore({ sessionRegistry: createMockRegistry() });
			const entry: SessionEntry = {
				id: '1',
				sessionKey: 'test',
				channel: 'telegram',
				peerKind: 'direct',
				peerId: '123',
				startedAt: new Date('2024-01-01'),
				lastActivityAt: new Date('2024-01-01'),
			};
			expect(store.isSessionExpired(entry, { mode: 'none', atHour: 4, idleMinutes: 1440, notify: true })).toBe(false);
		});

		it('should return true when idle timeout exceeded', () => {
			const store = new SessionStore({ sessionRegistry: createMockRegistry() });
			const entry: SessionEntry = {
				id: '1',
				sessionKey: 'test',
				channel: 'telegram',
				peerKind: 'direct',
				peerId: '123',
				startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
				lastActivityAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
			};
			expect(store.isSessionExpired(entry, { mode: 'idle', atHour: 4, idleMinutes: 1440, notify: true })).toBe(true);
		});

		it('should return false when within idle timeout', () => {
			const store = new SessionStore({ sessionRegistry: createMockRegistry() });
			const entry: SessionEntry = {
				id: '1',
				sessionKey: 'test',
				channel: 'telegram',
				peerKind: 'direct',
				peerId: '123',
				startedAt: new Date(),
				lastActivityAt: new Date(),
			};
			expect(store.isSessionExpired(entry, { mode: 'idle', atHour: 4, idleMinutes: 1440, notify: true })).toBe(false);
		});

		it('should return true for daily reset when last activity before 4am today', () => {
			const store = new SessionStore({ sessionRegistry: createMockRegistry() });
			const now = new Date();
			const yesterday = new Date(now);
			yesterday.setDate(yesterday.getDate() - 1);
			yesterday.setHours(2, 0, 0, 0); // 2am yesterday

			const entry: SessionEntry = {
				id: '1',
				sessionKey: 'test',
				channel: 'telegram',
				peerKind: 'group',
				peerId: '123',
				startedAt: yesterday,
				lastActivityAt: yesterday,
			};
			expect(store.isSessionExpired(entry, { mode: 'daily', atHour: 4, idleMinutes: 1440, notify: true })).toBe(true);
		});

		it('should return false for daily reset when last activity after 4am today', () => {
			const store = new SessionStore({ sessionRegistry: createMockRegistry() });
			const now = new Date();
			now.setHours(10, 0, 0, 0); // 10am today

			const entry: SessionEntry = {
				id: '1',
				sessionKey: 'test',
				channel: 'telegram',
				peerKind: 'group',
				peerId: '123',
				startedAt: now,
				lastActivityAt: now,
			};
			expect(store.isSessionExpired(entry, { mode: 'daily', atHour: 4, idleMinutes: 1440, notify: true })).toBe(false);
		});

		it('should NOT expire when hasActiveProcesses returns true', () => {
			const store = new SessionStore({
				sessionRegistry: createMockRegistry(),
				hasActiveProcesses: () => true,
			});
			const entry: SessionEntry = {
				id: '1',
				sessionKey: 'test',
				channel: 'telegram',
				peerKind: 'direct',
				peerId: '123',
				startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
				lastActivityAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
			};
			expect(store.isSessionExpired(entry, { mode: 'idle', atHour: 4, idleMinutes: 1440, notify: true })).toBe(false);
		});
	});

	describe('getOrCreateSession', () => {
		it('should create new session if none exists', async () => {
			const registry = createMockRegistry();
			const store = new SessionStore({ sessionRegistry: registry });
			const result = await store.getOrCreateSession('test-key', {
				channel: 'telegram',
				peerKind: 'direct',
				peerId: '123',
			});
			expect(result.wasReset).toBe(false);
			expect(result.session.sessionKey).toBe('test-key');
			expect(result.session.channel).toBe('telegram');
			expect(result.session.peerKind).toBe('direct');
		});

		it('should reset idle expired session and return wasReset=true', async () => {
			const sessions: SessionEntry[] = [];
			const registry = createMockRegistry(sessions);
			const store = new SessionStore({ sessionRegistry: registry });

			// Seed an old expired session
			const oldSession: SessionEntry = {
				id: 'old-id',
				sessionKey: 'test-key',
				channel: 'telegram',
				peerKind: 'direct',
				peerId: '123',
				startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
				lastActivityAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
			};
			sessions.push(oldSession);

			// Mock resetSession to simulate the behavior without real DB
			const resetSessionSpy = vi.spyOn(store, 'resetSession').mockImplementation(async (key, reason) => {
				oldSession.endedAt = new Date();
				oldSession.resetReason = reason;
				const newSession: SessionEntry = {
					id: 'new-id',
					sessionKey: key,
					channel: oldSession.channel,
					peerKind: oldSession.peerKind,
					peerId: oldSession.peerId,
					startedAt: new Date(),
					lastActivityAt: new Date(),
					parentSessionId: oldSession.id,
				};
				sessions.push(newSession);
				return newSession;
			});

			const result = await store.getOrCreateSession('test-key', {
				channel: 'telegram',
				peerKind: 'direct',
				peerId: '123',
			});

			expect(result.wasReset).toBe(true);
			expect(result.resetReason).toBe('idle');
			expect(result.session.id).toBe('new-id');
			expect(result.session.parentSessionId).toBe('old-id');

			resetSessionSpy.mockRestore();
		});

		it('should return existing session if not expired', async () => {
			const sessions: SessionEntry[] = [];
			const registry = createMockRegistry(sessions);
			const store = new SessionStore({ sessionRegistry: registry });

			const existing: SessionEntry = {
				id: 'existing-id',
				sessionKey: 'test-key',
				channel: 'telegram',
				peerKind: 'direct',
				peerId: '123',
				startedAt: new Date(),
				lastActivityAt: new Date(),
			};
			sessions.push(existing);

			const result = await store.getOrCreateSession('test-key', {
				channel: 'telegram',
				peerKind: 'direct',
				peerId: '123',
			});

			expect(result.wasReset).toBe(false);
			expect(result.session.id).toBe('existing-id');
		});
	});

	describe('getResetNotification', () => {
		it('should return notification for telegram idle reset', () => {
			const store = new SessionStore({ sessionRegistry: createMockRegistry() });
			const notification = store.getResetNotification('idle', 'telegram', 1440);
			expect(notification).toContain('Sessão anterior expirou');
			expect(notification).toContain('24h');
		});

		it('should return undefined for api_server channel', () => {
			const store = new SessionStore({ sessionRegistry: createMockRegistry() });
			const notification = store.getResetNotification('idle', 'api_server', 1440);
			expect(notification).toBeUndefined();
		});

		it('should return undefined for webhook channel', () => {
			const store = new SessionStore({ sessionRegistry: createMockRegistry() });
			const notification = store.getResetNotification('idle', 'webhook', 1440);
			expect(notification).toBeUndefined();
		});
	});
});
