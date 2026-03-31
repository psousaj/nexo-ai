import { filterToolNamesByPolicy, getToolExecutionPolicy, getToolDefinition } from '@nexo/api-core/services/tools/registry';
import { describe, expect, test } from 'vitest';

describe('tool registry execution policy', () => {
	test('delete tools exigem confirmacao (ask)', () => {
		expect(getToolExecutionPolicy('delete_memory')).toBe('ask');
		expect(getToolExecutionPolicy('delete_all_memories')).toBe('ask');
	});

	test('save_memory permanece habilitada como allow', () => {
		expect(getToolExecutionPolicy('save_memory')).toBe('allow');
		expect(getToolDefinition('save_memory')?.label).toBe('Salvar Memória');
	});

	test('filtro por policy remove ask/deny ao expor tools para loop LLM', () => {
		const result = filterToolNamesByPolicy(['save_note', 'save_memory', 'delete_memory', 'delete_all_memories']);
		expect(result).toEqual(['save_note', 'save_memory']);
	});
});
