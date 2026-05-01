import { CloudflareAIGatewayProvider } from '@/services/ai/cloudflare-ai-gateway-provider';
import OpenAI from 'openai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
				messages: expect.arrayContaining([
					expect.objectContaining({ role: 'user', content: expect.stringContaining('hello') }),
				]),
			}),
		);
	});

	it('deve enviar o histórico como turns separados (não formato TOON)', async () => {
		mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
			id: 'test-id',
			choices: [{ message: { content: 'test response' } }],
		});

		await provider.callLLM({
			message: 'pergunta atual',
			history: [{ role: 'user', content: 'pergunta anterior' }],
		});

		const lastCall = mockOpenAIInstance.chat.completions.create.mock.calls[0][0];
		const allMessages = lastCall.messages;

		// Histórico deve ser um turn separado
		const historyMsg = allMessages.find((m: any) => m.role === 'user' && m.content === 'pergunta anterior');
		expect(historyMsg).toBeDefined();
		expect(historyMsg?.content).toBe('pergunta anterior');

		// Última mensagem deve ser a pergunta atual
		const lastMsg = allMessages[allMessages.length - 1];
		expect(lastMsg.role).toBe('user');
		expect(lastMsg.content).toBe('pergunta atual');
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
});
