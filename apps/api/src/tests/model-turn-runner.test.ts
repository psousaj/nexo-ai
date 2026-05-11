import { describe, expect, it, vi } from 'vitest';
import { DefaultModelTurnRunner } from '../core/model/model-turn-runner';
import type { PostgresTranscriptStore } from '../core/session/transcript-store';

vi.mock('openai', () => ({
	default: class MockOpenAI {
		chat = {
			completions: {
				create: vi.fn(() =>
					Promise.resolve({
						choices: [
							{
								message: {
									role: 'assistant',
									content: 'Hello!',
								},
							},
						],
					}),
				),
			},
		};
	},
}));

vi.mock('../core/model/transports', () => ({
	detectApiMode: vi.fn(() => 'openai'),
	getTransport: vi.fn(() => ({
		buildKwargs: vi.fn(({ messages }: any) => ({
			model: 'gpt-4o-mini',
			messages,
		})),
		normalizeResponse: vi.fn((raw: any) => ({
			content: raw.choices?.[0]?.message?.content ?? '',
			toolCalls: undefined,
			providerData: {},
		})),
	})),
}));

vi.mock('../core/model/credential-pool', () => ({
	CredentialPool: class MockCredentialPool {
		resolveAny() {
			return { provider: 'openai', apiKey: 'test-key', baseURL: 'https://api.openai.com' };
		}
		resolve() {
			return { provider: 'openai', apiKey: 'test-key', baseURL: 'https://api.openai.com' };
		}
		markExhausted() {}
		static fromEnv() {
			return new MockCredentialPool();
		}
	},
}));

describe('DefaultModelTurnRunner', () => {
	const createMockStore = (): PostgresTranscriptStore => ({
		load: vi.fn(() => Promise.resolve([])),
		append: vi.fn(() => Promise.resolve()),
		getLastSequence: vi.fn(() => Promise.resolve(-1)),
	});

	describe('history loading', () => {
		it('should load history from store on construction', async () => {
			const store = createMockStore();
			(store.load as any).mockResolvedValue([
				{ role: 'user', content: 'Hello', sequence: 0, timestamp: new Date() },
				{ role: 'assistant', content: 'Hi', sequence: 1, timestamp: new Date() },
			]);

			const runner = new DefaultModelTurnRunner({
				transcriptStore: store,
				sessionId: 'sess-1',
			});

			// Trigger history load by calling next
			await runner.next({
				systemPrompt: 'You are a bot',
				sessionKey: 'sess-key',
				userMessage: 'New message',
			});

			expect(store.load).toHaveBeenCalledWith('sess-1');
		});

		it('should not load history when store or sessionId missing', async () => {
			const store = createMockStore();
			const runner = new DefaultModelTurnRunner({
				credentialPool: undefined,
			});

			// Should not throw even without store/sessionId
			const result = await runner.next({
				systemPrompt: 'You are a bot',
				sessionKey: 'sess-key',
				userMessage: 'Hello',
			});

			expect(store.load).not.toHaveBeenCalled();
			expect(result.type).toBe('respond');
		});
	});

	describe('persisting messages', () => {
		it('should persist user message', async () => {
			const store = createMockStore();
			const runner = new DefaultModelTurnRunner({
				transcriptStore: store,
				sessionId: 'sess-1',
			});

			await runner.next({
				systemPrompt: 'You are a bot',
				sessionKey: 'sess-key',
				userMessage: 'User message',
			});

			expect(store.append).toHaveBeenCalledWith(
				'sess-1',
				expect.objectContaining({
					role: 'user',
					content: 'User message',
					sequence: 0,
				}),
			);
		});

		it('should persist assistant message', async () => {
			const store = createMockStore();
			const runner = new DefaultModelTurnRunner({
				transcriptStore: store,
				sessionId: 'sess-1',
			});

			await runner.next({
				systemPrompt: 'You are a bot',
				sessionKey: 'sess-key',
				userMessage: 'User message',
			});

			const appendCalls = (store.append as any).mock.calls;
			const assistantCall = appendCalls.find((call: any) => call[1].role === 'assistant');
			expect(assistantCall).toBeDefined();
			expect(assistantCall[1]).toMatchObject({
				role: 'assistant',
				content: 'Hello!',
				sequence: 1,
			});
		});

		it('should persist tool result', async () => {
			const store = createMockStore();
			const runner = new DefaultModelTurnRunner({
				transcriptStore: store,
				sessionId: 'sess-1',
			});

			await runner.addToolResult('search', 'call-1', { result: 'found' });

			expect(store.append).toHaveBeenCalledWith(
				'sess-1',
				expect.objectContaining({
					role: 'tool',
					content: JSON.stringify({ result: 'found' }),
					sequence: 0,
				}),
			);
		});
	});

	describe('needsAutoContinue', () => {
		it('should return false when messages are empty', () => {
			const runner = new DefaultModelTurnRunner({});
			expect(runner.needsAutoContinue()).toBe(false);
		});

		it('should return true when last message is from tool', async () => {
			const store = createMockStore();
			const runner = new DefaultModelTurnRunner({
				transcriptStore: store,
				sessionId: 'sess-1',
			});

			await runner.addToolResult('search', 'call-1', { result: 'found' });
			expect(runner.needsAutoContinue()).toBe(true);
		});

		it('should return false when last message is not from tool', async () => {
			const store = createMockStore();
			const runner = new DefaultModelTurnRunner({
				transcriptStore: store,
				sessionId: 'sess-1',
			});

			await runner.next({
				systemPrompt: 'You are a bot',
				sessionKey: 'sess-key',
				userMessage: 'Hello',
			});

			expect(runner.needsAutoContinue()).toBe(false);
		});
	});

	describe('sequence counter', () => {
		it('should start from 0 when no history', async () => {
			const store = createMockStore();
			const runner = new DefaultModelTurnRunner({
				transcriptStore: store,
				sessionId: 'sess-1',
			});

			await runner.next({
				systemPrompt: 'You are a bot',
				sessionKey: 'sess-key',
				userMessage: 'Hello',
			});

			const appendCalls = (store.append as any).mock.calls;
			expect(appendCalls[0][1].sequence).toBe(0);
			expect(appendCalls[1][1].sequence).toBe(1);
		});

		it('should resume sequence from loaded history', async () => {
			const store = createMockStore();
			(store.load as any).mockResolvedValue([
				{ role: 'user', content: 'Hello', sequence: 0, timestamp: new Date() },
				{ role: 'assistant', content: 'Hi', sequence: 1, timestamp: new Date() },
			]);

			const runner = new DefaultModelTurnRunner({
				transcriptStore: store,
				sessionId: 'sess-1',
			});

			await runner.next({
				systemPrompt: 'You are a bot',
				sessionKey: 'sess-key',
				userMessage: 'New message',
			});

			const appendCalls = (store.append as any).mock.calls;
			expect(appendCalls[0][1].sequence).toBe(2);
			expect(appendCalls[1][1].sequence).toBe(3);
		});
	});
});
