import {
	OpenAIGatewayTransport,
} from '@nexo/api-core/services/ai/openai-gateway-transport';
import { mapOpenAIFinishReasonToRuntimeStopReason } from '@nexo/api-core/services/ai/runtime-contract';
import OpenAI from 'openai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('openai', () => {
	const OpenAI = vi.fn();
	OpenAI.prototype.chat = {
		completions: {
			create: vi.fn(),
		},
	};
	return { default: OpenAI };
});

describe('OpenAIGatewayTransport', () => {
	let transport: OpenAIGatewayTransport;
	let mockOpenAIInstance: any;

	beforeEach(() => {
		vi.resetAllMocks();
		transport = new OpenAIGatewayTransport({
			accountId: 'acc-123',
			gatewayId: 'gateway-123',
			apiToken: 'token-123',
			model: 'openai/gpt-5.2',
		});
		mockOpenAIInstance = (OpenAI as any).mock.instances[0];
	});

	it('deve configurar baseURL do Gateway em /compat por padrão', () => {
		expect(OpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				apiKey: 'token-123',
				baseURL: 'https://gateway.ai.cloudflare.com/v1/acc-123/gateway-123/compat',
			}),
		);
		expect(transport.getBaseURL()).toBe('https://gateway.ai.cloudflare.com/v1/acc-123/gateway-123/compat');
	});

	it('deve injetar system prompt e mapear resposta para contrato canônico', async () => {
		mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
			choices: [
				{
					finish_reason: 'stop',
					message: {
						content: 'Resposta final',
						tool_calls: [
							{
								id: 'tool_1',
								type: 'function',
								function: {
									name: 'search_items',
									arguments: '{"query":"matrix"}',
								},
							},
						],
					},
				},
			],
			usage: {
				prompt_tokens: 11,
				completion_tokens: 7,
				total_tokens: 18,
			},
		});

		const response = await transport.createChatCompletion({
			conversationId: 'conv-1',
			userId: 'user-1',
			systemPrompt: 'You are helpful',
			messages: [{ role: 'user', content: 'oi' }],
		});

		expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				model: 'openai/gpt-5.2',
				messages: expect.arrayContaining([
					expect.objectContaining({ role: 'system', content: 'You are helpful' }),
					expect.objectContaining({ role: 'user', content: 'oi' }),
				]),
			}),
			expect.objectContaining({
				headers: expect.objectContaining({
					'cf-aig-collect-log': 'true',
				}),
			}),
		);

		expect(response.round.stopReason).toBe('end_turn');
		expect(response.round.usage).toEqual({
			inputTokens: 11,
			outputTokens: 7,
			totalTokens: 18,
		});
		expect(response.round.blocks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: 'assistant_text', text: 'Resposta final' }),
				expect.objectContaining({ type: 'tool_use', name: 'search_items' }),
			]),
		);
	});

	it('deve mapear finish reasons do OpenAI para stop reasons canônicos', () => {
		expect(mapOpenAIFinishReasonToRuntimeStopReason('tool_calls')).toBe('tool_use');
		expect(mapOpenAIFinishReasonToRuntimeStopReason('stop')).toBe('end_turn');
		expect(mapOpenAIFinishReasonToRuntimeStopReason('length')).toBe('max_tokens');
		expect(mapOpenAIFinishReasonToRuntimeStopReason('content_filter')).toBe('refusal');
		expect(mapOpenAIFinishReasonToRuntimeStopReason('something-else')).toBe('unknown');
	});

	it('deve capturar headers cf-aig quando withResponse estiver disponível', async () => {
		mockOpenAIInstance.chat.completions.create.mockReturnValueOnce({
			withResponse: vi.fn().mockResolvedValue({
				data: {
					choices: [
						{
							finish_reason: 'stop',
							message: {
								content: 'ok',
								tool_calls: [],
							},
						},
					],
					usage: {
						prompt_tokens: 2,
						completion_tokens: 1,
						total_tokens: 3,
					},
				},
				response: {
					headers: new Map<string, string>([
						['cf-aig-provider', 'openai'],
						['cf-aig-model', 'gpt-5.2'],
					]),
				},
			}),
		});

		const response = await transport.createChatCompletion({
			conversationId: 'conv-1',
			userId: 'user-1',
			messages: [{ role: 'user', content: 'oi' }],
		});

		expect(response.round.gatewayHeaders).toEqual(
			expect.objectContaining({
				cfAigProvider: 'openai',
				cfAigModel: 'gpt-5.2',
			}),
		);
	});
});