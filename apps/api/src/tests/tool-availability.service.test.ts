/**
 * Testes unitários para ToolAvailabilityService
 *
 * Valida:
 * - Cache hit → retorna resultado sem consultar DB
 * - Cache miss → consulta DB, salva em cache e retorna
 * - Redis indisponível → consulta DB mesmo sem cache
 * - invalidateCache → chama cacheDelete com a chave correta
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================
const { mockCacheGet, mockCacheSet, mockCacheDelete, mockGetEnabledTools } = vi.hoisted(() => {
	return {
		mockCacheGet: vi.fn(),
		mockCacheSet: vi.fn(),
		mockCacheDelete: vi.fn(),
		mockGetEnabledTools: vi.fn(),
	};
});

vi.mock('@/config/redis', () => ({
	cacheGet: mockCacheGet,
	cacheSet: mockCacheSet,
	cacheDelete: mockCacheDelete,
}));

vi.mock('@/services/tools/tool.service', () => ({
	toolService: {
		getEnabledTools: mockGetEnabledTools,
	},
}));

vi.mock('@/utils/logger', () => ({
	loggers: {
		ai: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
		app: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
	},
}));

vi.mock('@/services/service-instrumentation', () => ({
	instrumentService: (_name: string, service: unknown) => service,
}));

// ============================================================================
// Import após mocks
// ============================================================================
const { toolAvailabilityService: service } = await import('@/services/tool-availability.service');

describe('ToolAvailabilityService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('getAvailableTools', () => {
		test('retorna cache quando disponível (cache hit)', async () => {
			const cached = { tools: ['save_note', 'search_items'] };
			mockCacheGet.mockResolvedValueOnce(cached);

			const result = await service.getAvailableTools();

			expect(result).toEqual(cached);
			expect(mockGetEnabledTools).not.toHaveBeenCalled();
		});

		test('consulta DB e salva em cache quando cache miss', async () => {
			mockCacheGet.mockResolvedValueOnce(null);
			mockGetEnabledTools.mockResolvedValueOnce([
				{ name: 'save_note' },
				{ name: 'save_movie' },
				{ name: 'search_items' },
			]);
			mockCacheSet.mockResolvedValueOnce(undefined);

			const result = await service.getAvailableTools();

			expect(result.tools).toEqual(['save_note', 'save_movie', 'search_items']);
			expect(mockGetEnabledTools).toHaveBeenCalledOnce();
			expect(mockCacheSet).toHaveBeenCalledWith(
				'tool_availability:global',
				{ tools: ['save_note', 'save_movie', 'search_items'] },
				3600,
			);
		});

		test('funciona mesmo quando Redis lança exceção no cacheGet', async () => {
			mockCacheGet.mockRejectedValueOnce(new Error('Redis connection refused'));
			mockGetEnabledTools.mockResolvedValueOnce([{ name: 'save_note' }]);
			mockCacheSet.mockResolvedValueOnce(undefined);

			const result = await service.getAvailableTools();

			expect(result.tools).toEqual(['save_note']);
			expect(mockGetEnabledTools).toHaveBeenCalledOnce();
		});

		test('funciona mesmo quando Redis lança exceção no cacheSet', async () => {
			mockCacheGet.mockResolvedValueOnce(null);
			mockGetEnabledTools.mockResolvedValueOnce([{ name: 'save_note' }]);
			mockCacheSet.mockRejectedValueOnce(new Error('Redis write fail'));

			const result = await service.getAvailableTools();

			expect(result.tools).toEqual(['save_note']);
		});

		test('retorna lista vazia quando nenhuma tool está habilitada', async () => {
			mockCacheGet.mockResolvedValueOnce(null);
			mockGetEnabledTools.mockResolvedValueOnce([]);

			const result = await service.getAvailableTools();

			expect(result.tools).toEqual([]);
		});
	});

	describe('invalidateCache', () => {
		test('chama cacheDelete com a chave correta', async () => {
			mockCacheDelete.mockResolvedValueOnce(undefined);

			await service.invalidateCache();

			expect(mockCacheDelete).toHaveBeenCalledWith('tool_availability:global');
		});

		test('não lança erro quando Redis falha no delete', async () => {
			mockCacheDelete.mockRejectedValueOnce(new Error('Redis error'));

			await expect(service.invalidateCache()).resolves.toBeUndefined();
		});
	});
});
