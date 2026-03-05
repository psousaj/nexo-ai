import { CloudflareAIGatewayProvider } from '@/services/ai/cloudflare-ai-gateway-provider';
import OpenAI from 'openai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockObserveOpenAI, mockObservedCreate, mockGetLangfuse, mockPromptGet } = vi.hoisted(() => ({
	mockObserveOpenAI: vi.fn(),
	mockObservedCreate: vi.fn(),
	mockGetLangfuse: vi.fn(),
	mockPromptGet: vi.fn(),
}));

vi.mock('@langfuse/openai', () => ({
	observeOpenAI: mockObserveOpenAI,
}));

vi.mock('@/services/langfuse', () => ({
	getLangfuse: mockGetLangfuse,
}));

// Mock do OpenAI SDK
vi.mock('openai', () => {
	const OpenAI = vi.fn();
	OpenAI.prototype.chat = {
		completions: {
			create: vi.fn(),
		},
	};
	return { default: OpenAI };
});

describe('CloudflareAIGatewayProvider', () => {
	let provider: CloudflareAIGatewayProvider;
	let mockOpenAIInstance: any;

	beforeEach(() => {
		vi.resetAllMocks();
		delete process.env.LANGFUSE_PROMPT_NAME;
		delete process.env.LANGFUSE_PROMPT_LABEL;
		mockGetLangfuse.mockReturnValue(null);
		mockObserveOpenAI.mockReturnValue({
			chat: {
				completions: {
					create: mockObservedCreate,
				},
			},
		});
		mockPromptGet.mockReset();
		mockObservedCreate.mockReset();
		provider = new CloudflareAIGatewayProvider('test-account', 'test-gateway', 'test-token', 'dynamic/cloudflare');
		mockOpenAIInstance = (OpenAI as any).mock.instances[0];
	});

	it('deve inicializar o cliente OpenAI com a baseURL correta do AI Gateway', () => {
		expect(OpenAI).toHaveBeenCalledWith({
			apiKey: 'test-token',
			baseURL: 'https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/compat',
		});
	});

	it('deve chamar chat.completions.create com o modelo correto', async () => {
		mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
			id: 'test-id',
			choices: [{ message: { content: 'test response' } }],
			usage: { total_tokens: 10 },
		});

		const result = await provider.callLLM({ message: 'hello' });

		expect(result.message).toBe('test response');
		expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				model: 'dynamic/cloudflare',
				messages: expect.arrayContaining([expect.objectContaining({ role: 'user', content: expect.stringContaining('hello') })]),
			}),
		);
	});

	it('deve converter o histórico para formato TOON antes de enviar', async () => {
		mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
			id: 'test-id',
			choices: [{ message: { content: 'test response' } }],
		});

		await provider.callLLM({
			message: 'pergunta atual',
			history: [{ role: 'user', content: 'pergunta anterior' }],
		});

		const lastCall = mockOpenAIInstance.chat.completions.create.mock.calls[0][0];
		const userMessage = lastCall.messages.find((m: any) => m.role === 'user').content;

		expect(userMessage).toContain('formato TOON');
		expect(userMessage).toContain('pergunta anterior');
		expect(userMessage).toContain('pergunta atual');
	});

	it('deve enviar system prompt apenas na role system (sem duplicar no user content)', async () => {
		mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
			id: 'test-id',
			choices: [{ message: { content: 'ok' } }],
		});

		await provider.callLLM({
			message: 'responda em JSON',
			systemPrompt: 'RETURN ONLY JSON',
		});

		const lastCall = mockOpenAIInstance.chat.completions.create.mock.calls[0][0];
		expect(lastCall.messages).toEqual(expect.arrayContaining([expect.objectContaining({ role: 'system', content: 'RETURN ONLY JSON' })]));

		const userMessage = lastCall.messages.find((m: any) => m.role === 'user').content;
		expect(userMessage).toContain('responda em JSON');
		expect(userMessage).not.toContain('SYSTEM INSTRUCTIONS (MUST FOLLOW EXACTLY):');
		expect(userMessage).not.toContain('RETURN ONLY JSON');
	});

	it('deve permitir alterar o modelo em runtime', async () => {
		provider.setModel('google-ai-studio/gemini-2.5-flash-lite');

		mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
			id: 'test-id',
			choices: [{ message: { content: 'ok' } }],
		});

		await provider.callLLM({ message: 'test' });

		expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				model: 'google-ai-studio/gemini-2.5-flash-lite',
			}),
		);
	});

	it('deve usar observeOpenAI e linkar prompt quando LANGFUSE_PROMPT_NAME estiver configurado', async () => {
		process.env.LANGFUSE_PROMPT_NAME = 'agent-system';
		process.env.LANGFUSE_PROMPT_LABEL = 'production';

		mockGetLangfuse.mockReturnValue({
			prompt: {
				get: mockPromptGet.mockResolvedValue({
					name: 'agent-system',
					version: 3,
				}),
			},
		});

		mockObservedCreate.mockResolvedValueOnce({
			id: 'test-id',
			choices: [{ message: { content: 'ok' } }],
			usage: { total_tokens: 10 },
		});

		const result = await provider.callLLM({
			message: 'hello',
			systemPrompt: 'RETURN JSON',
		});

		expect(result.message).toBe('ok');
		expect(mockPromptGet).toHaveBeenCalledWith('agent-system', { label: 'production' });
		expect(mockObserveOpenAI).toHaveBeenCalledTimes(1);
		expect(mockObservedCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				model: 'dynamic/cloudflare',
			}),
		);
	});
});
