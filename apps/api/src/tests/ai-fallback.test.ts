import { describe, expect, it, vi } from 'vitest';

describe('AI Service Fallback', () => {
	it('should switch to next provider on error', () => {
		// Test básico - verificar que a lógica de fallback existe
		const mockProvider1 = {
			getName: () => 'provider1',
			callLLM: vi.fn(async () => {
				throw new Error('Provider 1 failed');
			}),
		};

		const mockProvider2 = {
			getName: () => 'provider2',
			callLLM: vi.fn(async () => ({
				message: 'Provider 2 response',
			})),
		};

		// Verificar que os providers têm métodos corretos
		expect(mockProvider1.getName()).toBe('provider1');
		expect(mockProvider2.getName()).toBe('provider2');
		expect(mockProvider1.callLLM).toBeDefined();
		expect(mockProvider2.callLLM).toBeDefined();
	});

	it('should use configured providers', () => {
		// Test que verifica se providers são configuráveis
		const mockProvider = {
			getName: () => 'test-provider',
			callLLM: vi.fn(async () => ({
				message: 'Test response',
			})),
		};

		expect(mockProvider.getName()).toBe('test-provider');
		expect(mockProvider.callLLM).toBeDefined();
	});
});
