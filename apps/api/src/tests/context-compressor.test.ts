import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextCompressor, resetCompressionCooldown } from '../core/session/context-compressor';
import type { TranscriptEntry, TranscriptStore } from '../core/session/transcript-store';

// Mock db and schema
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('@/db', () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: mockDbSelect }) }) }),
		insert: () => ({
			values: (data: any) => ({
				returning: () => mockDbInsert(data),
			}),
		}),
		update: () => ({ set: () => ({ where: mockDbUpdate }) }),
	},
}));

vi.mock('@/db/schema/agent-sessions', () => ({
	agentSessions: {},
}));

vi.mock('drizzle-orm', () => ({
	eq: () => ({}),
}));

describe('ContextCompressor', () => {
	let transcriptStore: TranscriptStore;
	let sessionRegistry: any;

	beforeEach(() => {
		vi.clearAllMocks();
		resetCompressionCooldown();
		transcriptStore = {
			save: vi.fn().mockResolvedValue(undefined),
			load: vi.fn().mockResolvedValue([]),
		};
		sessionRegistry = {
			load: vi.fn().mockResolvedValue({ id: 'new-session-id' }),
			save: vi.fn().mockResolvedValue(undefined),
		};
		mockDbSelect.mockResolvedValue([]);
		mockDbInsert.mockResolvedValue([{ id: 'new-session-id' }]);
		mockDbUpdate.mockResolvedValue(undefined);
	});

	function makeMessages(count: number): TranscriptEntry[] {
		return Array.from({ length: count }, (_, i) => ({
			role: i % 2 === 0 ? 'user' : 'assistant',
			content: `Message ${i}`,
		}));
	}

	describe('threshold check', () => {
		it('should not compress when below threshold', async () => {
			const compressor = new ContextCompressor({
				transcriptStore,
				sessionRegistry,
				threshold: 10,
			});
			const result = await compressor.checkAndCompress('sess-1', makeMessages(5));
			expect(result.compressed).toBe(false);
		});

		it('should compress when above threshold', async () => {
			mockDbSelect.mockResolvedValue([
				{
					id: 'old-sess',
					sessionKey: 'agent:main:telegram:direct:123',
					channel: 'telegram',
					peerKind: 'direct',
					peerId: '123',
				},
			]);

			const compressor = new ContextCompressor({
				transcriptStore,
				sessionRegistry,
				threshold: 10,
				headKeep: 2,
				tailKeep: 4,
			});
			const result = await compressor.checkAndCompress('sess-1', makeMessages(20));
			expect(result.compressed).toBe(true);
			expect(result.newSessionKey).toBeDefined();
		});
	});

	describe('protected ranges', () => {
		it('should preserve head and tail messages', async () => {
			mockDbSelect.mockResolvedValue([
				{
					id: 'old-sess',
					sessionKey: 'agent:main:telegram:direct:123',
					channel: 'telegram',
					peerKind: 'direct',
					peerId: '123',
				},
			]);

			const compressor = new ContextCompressor({
				transcriptStore,
				sessionRegistry,
				threshold: 10,
				headKeep: 2,
				tailKeep: 4,
			});

			const messages = makeMessages(20);
			await compressor.checkAndCompress('sess-1', messages);

			// Check that transcriptStore.save was called with compressed entries
			const savedArgs = (transcriptStore.save as any).mock.calls[0];
			const savedEntries: TranscriptEntry[] = savedArgs[1];

			// Head + summary + tail = 2 + 1 + 4 = 7
			expect(savedEntries.length).toBe(7);
			expect(savedEntries[0].content).toBe('Message 0');
			expect(savedEntries[1].content).toBe('Message 1');
			expect(savedEntries[savedEntries.length - 1].content).toBe('Message 19');
			expect(savedEntries[savedEntries.length - 2].content).toBe('Message 18');
		});
	});

	describe('preprocessing', () => {
		it('should filter out system and empty messages', async () => {
			mockDbSelect.mockResolvedValue([
				{
					id: 'old-sess',
					sessionKey: 'agent:main:telegram:direct:123',
					channel: 'telegram',
					peerKind: 'direct',
					peerId: '123',
				},
			]);

			const compressor = new ContextCompressor({
				transcriptStore,
				sessionRegistry,
				threshold: 5,
				headKeep: 1,
				tailKeep: 1,
			});

			const messages: TranscriptEntry[] = [
				{ role: 'system', content: 'system prompt' },
				{ role: 'user', content: 'hello' },
				{ role: 'assistant', content: '' },
				{ role: 'user', content: 'world' },
				{ role: 'assistant', content: 'hi' },
				{ role: 'user', content: 'foo' },
				{ role: 'assistant', content: 'bar' },
			];

			const result = await compressor.checkAndCompress('sess-1', messages);
			expect(result.compressed).toBe(true);

			const savedArgs = (transcriptStore.save as any).mock.calls[0];
			const savedEntries: TranscriptEntry[] = savedArgs[1];

			// After filtering: hello, world, hi, foo, bar -> head 1 + tail 1 + summary = 3
			expect(savedEntries.length).toBe(3);
			expect(savedEntries[0].content).toBe('hello');
			expect(savedEntries[savedEntries.length - 1].content).toBe('bar');
		});
	});

	describe('anti-thrashing / cooldown', () => {
		it('should not compress again within cooldown', async () => {
			mockDbSelect.mockResolvedValue([
				{
					id: 'old-sess',
					sessionKey: 'agent:main:telegram:direct:123',
					channel: 'telegram',
					peerKind: 'direct',
					peerId: '123',
				},
			]);

			const compressor = new ContextCompressor({
				transcriptStore,
				sessionRegistry,
				threshold: 10,
				cooldownMinutes: 60,
			});

			// First compression
			const r1 = await compressor.checkAndCompress('sess-1', makeMessages(20));
			expect(r1.compressed).toBe(true);

			// Immediate second attempt should be blocked
			const r2 = await compressor.checkAndCompress('sess-1', makeMessages(20));
			expect(r2.compressed).toBe(false);
		});
	});

	describe('session split', () => {
		it('should create new session with parent reference', async () => {
			const oldSession = {
				id: 'old-sess',
				sessionKey: 'agent:main:telegram:direct:123',
				channel: 'telegram',
				peerKind: 'direct',
				peerId: '123',
				agentId: 'main',
				accountId: null,
				userId: null,
				conversationId: null,
				model: null,
				thinkingLevel: null,
				dmScope: 'per-peer',
			};
			mockDbSelect.mockResolvedValue([oldSession]);

			const compressor = new ContextCompressor({
				transcriptStore,
				sessionRegistry,
				threshold: 10,
			});

			const result = await compressor.checkAndCompress('old-sess', makeMessages(20));
			expect(result.compressed).toBe(true);
			expect(result.newSessionKey).toMatch(/^agent:main:telegram:direct:123:compressed:\d+$/);

			// Verify old session was marked ended
			expect(mockDbUpdate).toHaveBeenCalled();

			// Verify new session insert
			expect(mockDbInsert).toHaveBeenCalled();
			const insertCall = mockDbInsert.mock.calls[0];
			const newSessionData = insertCall[0];
			expect(newSessionData.parentSessionId).toBe('old-sess');
			expect(newSessionData.sessionKey).toMatch(/:compressed:/);
		});
	});

	describe('cooldown reset across instances', () => {
		it('should share cooldown state globally', async () => {
			mockDbSelect.mockResolvedValue([
				{
					id: 'old-sess',
					sessionKey: 'agent:main:telegram:direct:123',
					channel: 'telegram',
					peerKind: 'direct',
					peerId: '123',
				},
			]);

			const compressor1 = new ContextCompressor({
				transcriptStore,
				sessionRegistry,
				threshold: 10,
				cooldownMinutes: 60,
			});

			await compressor1.checkAndCompress('sess-1', makeMessages(20));

			// New instance should still respect cooldown
			const compressor2 = new ContextCompressor({
				transcriptStore,
				sessionRegistry,
				threshold: 10,
				cooldownMinutes: 60,
			});

			const result = await compressor2.checkAndCompress('sess-1', makeMessages(20));
			expect(result.compressed).toBe(false);
		});
	});
});
