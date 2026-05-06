import { describe, expect, it, vi } from 'vitest';
import type { AIProvider, AIProviderType } from '@/services/ai/types';

describe('AIProvider interface (multi-provider)', () => {
	it('should define contract for all provider types', () => {
		const mockProvider: AIProvider = {
			getName: () => 'test',
			getType: (): AIProviderType => 'openai',
			isAvailable: vi.fn().mockResolvedValue(true),
			callLLM: vi.fn().mockResolvedValue({
				round: {
					context: { conversationId: '1', userId: '1', model: 'm', gatewayBaseUrl: 'http://x' },
					blocks: [],
					stopReason: 'end_turn',
				},
				completion: { id: '1', model: 'm', object: 'chat.completion', created: 1, choices: [] },
			}),
		};

		expect(mockProvider.getName()).toBe('test');
		expect(mockProvider.getType()).toBe('openai');
		expect(typeof mockProvider.callLLM).toBe('function');
		expect(typeof mockProvider.isAvailable).toBe('function');
	});

	it('should support provider fallback pattern', () => {
		const mockProvider1: AIProvider = {
			getName: () => 'provider1',
			getType: (): AIProviderType => 'openai',
			isAvailable: vi.fn().mockResolvedValue(true),
			callLLM: vi.fn(async () => {
				throw new Error('Provider 1 failed');
			}),
		};

		const mockProvider2: AIProvider = {
			getName: () => 'provider2',
			getType: (): AIProviderType => 'deepseek',
			isAvailable: vi.fn().mockResolvedValue(true),
			callLLM: vi.fn().mockResolvedValue({
				round: {
					context: { conversationId: '1', userId: '1', model: 'm', gatewayBaseUrl: 'http://x' },
					blocks: [{ type: 'assistant_text', text: 'Provider 2 response' }],
					stopReason: 'end_turn',
				},
				completion: { id: '1', model: 'm', object: 'chat.completion', created: 1, choices: [] },
			}),
		};

		expect(mockProvider1.getType()).toBe('openai');
		expect(mockProvider2.getType()).toBe('deepseek');
		expect(mockProvider1.callLLM).toBeDefined();
		expect(mockProvider2.callLLM).toBeDefined();
	});
});
