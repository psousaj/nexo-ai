import { describe, expect, it, vi } from 'vitest';

const { mockClassify } = vi.hoisted(() => ({
	mockClassify: vi.fn(),
}));

vi.mock('@nexo/api-core/services/intent-classifier', () => ({
	intentClassifier: {
		classify: mockClassify,
	},
}));

describe('executeIntentClassificationTask', () => {
	it('retorna bloco completed com metadados de intenção', async () => {
		mockClassify.mockResolvedValue({
			intent: 'save_content',
			action: 'save',
			confidence: 0.93,
		});

		const { executeIntentClassificationTask } = await import('@nexo/api-core/services/ai/intent-classification-task');
		const result = await executeIntentClassificationTask({
			message: 'salva esse link',
			phase: 'main',
		});

		expect(result.intent).toEqual({
			intent: 'save_content',
			action: 'save',
			confidence: 0.93,
		});
		expect(result.block.status).toBe('completed');
		expect(result.block.task).toBe('intent_classification');
		expect(result.block.metadata).toEqual(
			expect.objectContaining({
				phase: 'main',
				intent: 'save_content',
				action: 'save',
				confidence: 0.93,
			}),
		);
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});

	it('retorna fallback unknown e bloco failed quando classificador falha', async () => {
		mockClassify.mockRejectedValue(new Error('classifier timeout'));

		const { executeIntentClassificationTask } = await import('@nexo/api-core/services/ai/intent-classification-task');
		const result = await executeIntentClassificationTask({
			message: 'qualquer coisa',
			phase: 'off_topic_reentry',
		});

		expect(result.intent).toEqual({
			intent: 'unknown',
			action: 'unknown',
			confidence: 0,
		});
		expect(result.block.status).toBe('failed');
		expect(result.block.error).toContain('classifier timeout');
		expect(result.block.metadata).toEqual(
			expect.objectContaining({
				phase: 'off_topic_reentry',
			}),
		);
	});
});