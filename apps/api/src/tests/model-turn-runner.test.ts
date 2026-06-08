import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultModelTurnRunner } from '../core/model/model-turn-runner';
import type { PostgresTranscriptStore } from '../core/session/transcript-store';

// Shared mock that tests can mutate
let mockNormalizeResponse = vi.fn();

vi.mock('openai', () => ({
	default: class MockOpenAI {
		chat = {
			completions: {
				create: vi.fn(() =>
					Promise.resolve({
						choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
					}),
				),
			},
		};
	},
}));

vi.mock('../core/model/transports', () => ({
	detectApiMode: vi.fn(() => 'openai'),
	getTransport: vi.fn(() => ({
		buildKwargs: vi.fn(({ messages }: any) => ({ model: 'gpt-4o-mini', messages })),
		normalizeResponse: vi.fn((raw: any) => mockNormalizeResponse(raw)),
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

	beforeEach(() => {
		mockNormalizeResponse = vi.fn(() => ({
			content: 'Hello!',
			toolCalls: undefined,
			providerData: {},
		}));
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

			await runner.next({
				systemPrompt: 'You are a bot',
				sessionKey: 'sess-key',
				userMessage: 'New message',
			});

			expect(store.load).toHaveBeenCalledWith('sess-1');
		});

		it('should not load history when store or sessionId missing', async () => {
			const store = createMockStore();
			const runner = new DefaultModelTurnRunner({ credentialPool: undefined });

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
			const runner = new DefaultModelTurnRunner({ transcriptStore: store, sessionId: 'sess-1' });

			await runner.next({
				systemPrompt: 'You are a bot',
				sessionKey: 'sess-key',
				userMessage: 'User message',
			});

			expect(store.append).toHaveBeenCalledWith(
				'sess-1',
				expect.objectContaining({ role: 'user', content: 'User message', sequence: 0 }),
			);
		});

		it('should persist assistant message', async () => {
			const store = createMockStore();
			const runner = new DefaultModelTurnRunner({ transcriptStore: store, sessionId: 'sess-1' });

			await runner.next({
				systemPrompt: 'You are a bot',
				sessionKey: 'sess-key',
				userMessage: 'User message',
			});

			const appendCalls = (store.append as any).mock.calls;
			const assistantCall = appendCalls.find((call: any) => call[1].role === 'assistant');
			expect(assistantCall).toBeDefined();
			expect(assistantCall[1]).toMatchObject({ role: 'assistant', content: 'Hello!', sequence: 1 });
		});

		it('should persist tool result', async () => {
			const store = createMockStore();
			const runner = new DefaultModelTurnRunner({ transcriptStore: store, sessionId: 'sess-1' });

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
			const runner = new DefaultModelTurnRunner({ transcriptStore: store, sessionId: 'sess-1' });

			await runner.addToolResult('search', 'call-1', { result: 'found' });
			expect(runner.needsAutoContinue()).toBe(true);
		});

		it('should return false when last message is not from tool', async () => {
			const store = createMockStore();
			const runner = new DefaultModelTurnRunner({ transcriptStore: store, sessionId: 'sess-1' });

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
			const runner = new DefaultModelTurnRunner({ transcriptStore: store, sessionId: 'sess-1' });

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

			const runner = new DefaultModelTurnRunner({ transcriptStore: store, sessionId: 'sess-1' });

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

	describe('batch tool calls', () => {
		it('should return all tool calls in toolCalls array', async () => {
			mockNormalizeResponse = vi.fn(() => ({
				content: '',
				toolCalls: [
					{ id: 'call-1', name: 'search', arguments: { q: 'X' } },
					{ id: 'call-2', name: 'search', arguments: { q: 'Y' } },
				],
				providerData: {},
			}));

			const store = createMockStore();
			const runner = new DefaultModelTurnRunner({ transcriptStore: store, sessionId: 'sess-1' });

			const result = await runner.next({
				systemPrompt: 'You are a bot',
				sessionKey: 'sess-key',
				userMessage: 'Do X and Y',
				tools: [{ name: 'search', description: 'Search', parameters: {} }],
			});

			expect(result.type).toBe('tool');
			expect(result.toolCalls).toBeDefined();
			expect(result.toolCalls!.length).toBe(2);
			expect(result.toolCalls![0]).toMatchObject({ toolName: 'search', toolCallId: 'call-1', input: { q: 'X' } });
			expect(result.toolCalls![1]).toMatchObject({ toolName: 'search', toolCallId: 'call-2', input: { q: 'Y' } });
		});

		it('should return single tool call in toolCalls array', async () => {
			mockNormalizeResponse = vi.fn(() => ({
				content: '',
				toolCalls: [{ id: 'call-1', name: 'search', arguments: { q: 'test' } }],
				providerData: {},
			}));

			const store = createMockStore();
			const runner = new DefaultModelTurnRunner({ transcriptStore: store, sessionId: 'sess-1' });

			const result = await runner.next({
				systemPrompt: 'You are a bot',
				sessionKey: 'sess-key',
				userMessage: 'Single tool',
				tools: [{ name: 'search', description: 'Search', parameters: {} }],
			});

			expect(result.type).toBe('tool');
			expect(result.toolCalls).toBeDefined();
			expect(result.toolCalls!.length).toBe(1);
			expect(result.toolCalls![0]).toMatchObject({ toolName: 'search', toolCallId: 'call-1' });
		});
	});

	describe('crash recovery - sanitize incomplete tool calls', () => {
		it('should add stub results when tool responses are missing after load', async () => {
			const store = createMockStore();
			(store.load as any).mockResolvedValue([
				{
					role: 'user',
					content: 'do X and Y',
					sequence: 0,
					timestamp: new Date(),
				},
				{
					role: 'assistant',
					content: '',
					tool_calls: [
						{ id: 'call-1', type: 'function', function: { name: 'search', arguments: '{"q":"X"}' } },
						{ id: 'call-2', type: 'function', function: { name: 'search', arguments: '{"q":"Y"}' } },
					],
					sequence: 1,
					timestamp: new Date(),
				},
				{
					role: 'tool',
					content: '{"result":"found X"}',
					tool_call_id: 'call-1',
					sequence: 2,
					timestamp: new Date(),
				},
			]);

			const runner = new DefaultModelTurnRunner({ transcriptStore: store, sessionId: 'sess-1' });

			// Trigger history load — sanitizeIncompleteToolCallsInHistory runs here
			await runner.next({
				systemPrompt: 'You are a bot',
				sessionKey: 'sess-key',
				userMessage: 'continue',
			});

			// Check that stub was added to messages
			const messages = runner.getMessages();
			const toolMessages = messages.filter((m: any) => m.role === 'tool');
			const stubMsg = toolMessages.find((m: any) => m.tool_call_id === 'call-2');
			expect(stubMsg).toBeDefined();
			expect(stubMsg!.content).toBe('[Result from earlier conversation]');
		});

		it('should not add stubs when all tool responses are present', async () => {
			const store = createMockStore();
			(store.load as any).mockResolvedValue([
				{
					role: 'assistant',
					content: '',
					tool_calls: [
						{ id: 'call-1', type: 'function', function: { name: 'search', arguments: '{"q":"X"}' } },
						{ id: 'call-2', type: 'function', function: { name: 'search', arguments: '{"q":"Y"}' } },
					],
					sequence: 0,
					timestamp: new Date(),
				},
				{
					role: 'tool',
					content: '{"result":"found X"}',
					tool_call_id: 'call-1',
					sequence: 1,
					timestamp: new Date(),
				},
				{
					role: 'tool',
					content: '{"result":"found Y"}',
					tool_call_id: 'call-2',
					sequence: 2,
					timestamp: new Date(),
				},
			]);

			const runner = new DefaultModelTurnRunner({ transcriptStore: store, sessionId: 'sess-1' });

			await runner.next({
				systemPrompt: 'You are a bot',
				sessionKey: 'sess-key',
				userMessage: 'continue',
			});

			// No stubs should be added — all tool_calls have responses
			const messages = runner.getMessages();
			const stubMsg = messages.find(
				(m: any) => m.role === 'tool' && m.content === '[Result from earlier conversation]',
			);
			expect(stubMsg).toBeUndefined();
		});

		it('should not add stubs when no assistant tool_calls exist', async () => {
			const store = createMockStore();
			(store.load as any).mockResolvedValue([
				{ role: 'user', content: 'Hello', sequence: 0, timestamp: new Date() },
				{ role: 'assistant', content: 'Hi', sequence: 1, timestamp: new Date() },
			]);

			const runner = new DefaultModelTurnRunner({ transcriptStore: store, sessionId: 'sess-1' });

			const result = await runner.next({
				systemPrompt: 'You are a bot',
				sessionKey: 'sess-key',
				userMessage: 'continue',
			});

			expect(result.type).toBe('respond');
		});
	});
});
