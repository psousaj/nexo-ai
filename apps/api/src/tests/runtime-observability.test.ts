import {
	buildRuntimeObservabilityAttributes,
	summarizeRuntimeRounds,
} from '@/services/ai/runtime-observability';
import { describe, expect, it } from 'vitest';

describe('runtime observability', () => {
	it('resume múltiplas rodadas canônicas com contadores e tokens', () => {
		const summary = summarizeRuntimeRounds([
			{
				context: {
					conversationId: 'conv-1',
					userId: 'user-1',
					model: 'openai/gpt-5.2',
					gatewayBaseUrl: '/compat',
				},
				blocks: [
					{ type: 'assistant_text', text: 'Olá' },
					{ type: 'tool_use', id: 'tool-1', name: 'search_items', input: {} },
					{ type: 'tool_result', toolUseId: 'tool-1', content: { ok: true } },
				],
				stopReason: 'tool_use',
				usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
			},
			{
				context: {
					conversationId: 'conv-1',
					userId: 'user-1',
					model: 'openai/gpt-5.2',
					gatewayBaseUrl: '/compat',
				},
				blocks: [
					{ type: 'internal_task', task: 'context_injection', async: false, status: 'completed' },
					{ type: 'error', code: 'x', message: 'erro', retryable: false },
				],
				stopReason: 'end_turn',
				usage: { inputTokens: 7, outputTokens: 8, totalTokens: 15 },
				gatewayHeaders: {
					cfAigProvider: 'openai',
					cfAigModel: 'gpt-5.2',
				},
			},
		]);

		expect(summary.roundCount).toBe(2);
		expect(summary.assistantTextBlocks).toBe(1);
		expect(summary.toolUseBlocks).toBe(1);
		expect(summary.toolResultBlocks).toBe(1);
		expect(summary.internalTaskBlocks).toBe(1);
		expect(summary.errorBlocks).toBe(1);
		expect(summary.inputTokens).toBe(17);
		expect(summary.outputTokens).toBe(13);
		expect(summary.totalTokens).toBe(30);
		expect(summary.stopReasons).toEqual(['tool_use', 'end_turn']);
		expect(summary.gatewayHeaders).toEqual(
			expect.objectContaining({
				cfAigProvider: 'openai',
				cfAigModel: 'gpt-5.2',
			}),
		);
	});

	it('gera atributos otel com prefixo customizado', () => {
		const attrs = buildRuntimeObservabilityAttributes(
			{
				roundCount: 1,
				assistantTextBlocks: 1,
				toolUseBlocks: 2,
				toolResultBlocks: 2,
				internalTaskBlocks: 1,
				errorBlocks: 0,
				inputTokens: 10,
				outputTokens: 5,
				totalTokens: 15,
				stopReasons: ['end_turn'],
				gatewayHeaders: {
					cfAigProvider: 'openai',
					cfAigModel: 'gpt-5.2',
				},
			},
			'runtime.manual',
		);

		expect(attrs['runtime.manual.rounds']).toBe(1);
		expect(attrs['runtime.manual.tool_use_blocks']).toBe(2);
		expect(attrs['runtime.manual.usage.total_tokens']).toBe(15);
		expect(attrs['runtime.manual.gateway.provider']).toBe('openai');
		expect(attrs['runtime.manual.stop_reasons']).toBe('end_turn');
	});
});