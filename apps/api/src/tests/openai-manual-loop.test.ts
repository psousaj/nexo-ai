import { buildManualLoopTools, runOpenAIManualLoop } from '@/services/ai/openai-manual-loop';
import { describe, expect, it, vi } from 'vitest';

describe('runOpenAIManualLoop', () => {
	it('executa tool call e conclui com resposta textual', async () => {
		const transport = {
			createChatCompletion: vi
				.fn()
				.mockResolvedValueOnce({
					completion: {
						choices: [
							{
								finish_reason: 'tool_calls',
								message: {
									content: '',
									tool_calls: [
										{
											id: 'call_1',
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
					},
					round: { blocks: [], stopReason: 'tool_use', context: {} },
				})
				.mockResolvedValueOnce({
					completion: {
						choices: [
							{
								finish_reason: 'stop',
								message: {
									content: 'Encontrei 3 itens relacionados.',
									tool_calls: [],
								},
							},
						],
					},
					round: { blocks: [], stopReason: 'end_turn', context: {} },
				}),
		};

		const executeTool = vi.fn().mockResolvedValue({
			success: true,
			data: {
				count: 3,
				items: [],
			},
		});

		const result = await runOpenAIManualLoop(
			{
				conversationId: 'conv-1',
				userId: 'user-1',
				systemPrompt: 'Você é útil',
				messages: [{ role: 'user', content: 'busca matrix' }],
				availableTools: ['search_items'],
				toolContext: {
					userId: 'user-1',
					conversationId: 'conv-1',
				} as any,
			},
			{ transport: transport as any, executeTool },
		);

		expect(executeTool).toHaveBeenCalledWith(
			'search_items',
			expect.objectContaining({ userId: 'user-1' }),
			expect.objectContaining({ query: 'matrix' }),
		);
		expect(result.toolsUsed).toEqual(['search_items']);
		expect(result.text).toBe('Encontrei 3 itens relacionados.');
		expect(result.rounds).toBe(2);
	});

	it('retorna erro de policy para tool fora da allowlist sem executar callback', async () => {
		const transport = {
			createChatCompletion: vi
				.fn()
				.mockResolvedValueOnce({
					completion: {
						choices: [
							{
								finish_reason: 'tool_calls',
								message: {
									content: '',
									tool_calls: [
										{
											id: 'call_1',
											type: 'function',
											function: {
												name: 'save_note',
												arguments: '{"content":"teste"}',
											},
										},
									],
								},
							},
						],
					},
					round: { blocks: [], stopReason: 'tool_use', context: {} },
				})
				.mockResolvedValueOnce({
					completion: {
						choices: [
							{
								finish_reason: 'stop',
								message: {
									content: 'Não posso executar essa ferramenta.',
									tool_calls: [],
								},
							},
						],
					},
					round: { blocks: [], stopReason: 'end_turn', context: {} },
				}),
		};

		const executeTool = vi.fn();

		const result = await runOpenAIManualLoop(
			{
				conversationId: 'conv-1',
				userId: 'user-1',
				systemPrompt: 'Você é útil',
				messages: [{ role: 'user', content: 'salva isso' }],
				availableTools: ['search_items'],
				toolContext: {
					userId: 'user-1',
					conversationId: 'conv-1',
				} as any,
			},
			{ transport: transport as any, executeTool: executeTool as any },
		);

		expect(executeTool).not.toHaveBeenCalled();
		expect(result.text).toBe('Não posso executar essa ferramenta.');
		expect(result.toolsUsed).toEqual(['save_note']);
	});
});

describe('buildManualLoopTools', () => {
	it('filtra tools pelo conjunto permitido', () => {
		const tools = buildManualLoopTools(['search_items', 'save_note']);
		expect(tools.map((t) => t.function.name).sort()).toEqual(['save_note', 'search_items']);
	});
});