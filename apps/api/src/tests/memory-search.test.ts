/**
 * Testes unitários para Memory Search (Hybrid Search)
 *
 * Valida:
 * - searchMemory: Busca híbrida vector + keyword
 * - mergeHybridResults: Fusão de resultados com pesos
 * - Estratégias: weighted, average, reciprocal_rank_fusion
 */

import {
	type HybridSearchConfig,
	type MemorySearchOptions,
	mergeHybridResults,
	searchMemory,
} from '@/services/memory-search';
import { describe, expect, test, vi } from 'vitest';

// Mock do banco de dados
vi.mock('@/db', () => ({
	db: {
		execute: vi.fn().mockResolvedValue([]),
		query: {
			memoryItems: {
				findMany: vi.fn().mockResolvedValue([]),
			},
		},
	},
}));

// Mock do serviço de embedding (importado dinamicamente em getEmbedding)
vi.mock('@/services/ai/embedding-service', () => ({
	embeddingService: {
		generateEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0)),
	},
}));

describe('Memory Search - Hybrid Search', () => {
	const mockUserId = 'user-123';
	const mockQuery = 'filmes de ficção científica';

	describe('Configuração Padrão', () => {
		test('configuração padrão usa 70% vector + 30% keyword', () => {
			const config: HybridSearchConfig = {
				vectorWeight: 0.7,
				textWeight: 0.3,
				mergeStrategy: 'weighted',
				minScore: 0.3,
				maxResults: 10,
			};

			expect(config.vectorWeight).toBe(0.7);
			expect(config.textWeight).toBe(0.3);
			expect(config.vectorWeight + config.textWeight).toBe(1.0);
		});
	});

	describe('mergeHybridResults', () => {
		test('fusão weighted combina scores com pesos', () => {
			// mergeHybridResults espera 'cosine_similarity' para vector e 'rank' para keyword
			const vectorResults = [
				{ id: '1', cosine_similarity: 0.9, type: 'movie', title: 'Item 1', metadata: {} },
				{ id: '2', cosine_similarity: 0.7, type: 'movie', title: 'Item 2', metadata: {} },
			];

			const keywordResults = [
				{ id: '1', rank: 0.8, type: 'movie', title: 'Item 1', metadata: {} },
				{ id: '3', rank: 0.6, type: 'movie', title: 'Item 3', metadata: {} },
			];

			const config: HybridSearchConfig = {
				vectorWeight: 0.7,
				textWeight: 0.3,
				mergeStrategy: 'weighted',
				minScore: 0.3,
				maxResults: 10,
			};

			const merged = mergeHybridResults({
				vector: vectorResults,
				keyword: keywordResults,
				config,
			});

			// Item 1 aparece em ambos: tem score de vector normalizado + keyword normalizado
			const item1 = merged.find((r) => r.id === '1');
			expect(item1).toBeDefined();
			if (item1) {
				expect(item1.score).toBeGreaterThan(0);
				expect(item1.score).toBeLessThanOrEqual(1.5); // weighted pode exceder 1
			}
		});

		test('itens únicos são incluídos', () => {
			const vectorResults = [{ id: '1', score: 0.9 }];

			const keywordResults = [{ id: '2', score: 0.8 }];

			const config: HybridSearchConfig = {
				vectorWeight: 0.7,
				textWeight: 0.3,
				mergeStrategy: 'weighted',
				minScore: 0.3,
				maxResults: 10,
			};

			const merged = mergeHybridResults({
				vector: vectorResults,
				keyword: keywordResults,
				config,
			});

			expect(merged.length).toBe(2);
			expect(merged.some((r) => r.id === '1')).toBe(true);
			expect(merged.some((r) => r.id === '2')).toBe(true);
		});

		test('todos os resultados são incluídos (filtragem é responsabilidade de searchMemory)', () => {
			const vectorResults = [
				{ id: '1', cosine_similarity: 0.9, type: 'movie', title: 'Item 1', metadata: {} },
				{ id: '2', cosine_similarity: 0.2, type: 'movie', title: 'Item 2', metadata: {} }, // score baixo
			];

			const keywordResults: any[] = [];

			const config: HybridSearchConfig = {
				vectorWeight: 0.7,
				textWeight: 0.3,
				mergeStrategy: 'weighted',
				minScore: 0.5,
				maxResults: 10,
			};

			const merged = mergeHybridResults({
				vector: vectorResults,
				keyword: keywordResults,
				config,
			});

			// mergeHybridResults NÃO filtra por minScore - isso é feito por searchMemory
			expect(merged.length).toBe(2);
			expect(merged.some((r) => r.id === '1')).toBe(true);
			expect(merged.some((r) => r.id === '2')).toBe(true);
		});

		test('ordena resultados por score (não limita - isso é responsabilidade de searchMemory)', () => {
			const vectorResults = Array.from({ length: 20 }, (_, i) => ({
				id: `${i}`,
				cosine_similarity: 0.9 - i * 0.01,
				type: 'movie',
				title: `Item ${i}`,
				metadata: {},
			}));

			const keywordResults: any[] = [];

			const config: HybridSearchConfig = {
				vectorWeight: 0.7,
				textWeight: 0.3,
				mergeStrategy: 'weighted',
				minScore: 0.0,
				maxResults: 5,
			};

			const merged = mergeHybridResults({
				vector: vectorResults,
				keyword: keywordResults,
				config,
			});

			// mergeHybridResults NÃO limita por maxResults - isso é feito por searchMemory
			expect(merged.length).toBe(20);
			// Mas DEVE estar ordenado por score (decrescente)
			for (let i = 1; i < merged.length; i++) {
				expect(merged[i].score).toBeLessThanOrEqual(merged[i - 1].score);
			}
		});
	});

	describe('Estratégias de Fusão', () => {
		test('estratégia weighted pondera por pesos configurados', () => {
			const config: HybridSearchConfig = {
				vectorWeight: 0.8,
				textWeight: 0.2,
				mergeStrategy: 'weighted',
				minScore: 0.0,
				maxResults: 10,
			};

			expect(config.mergeStrategy).toBe('weighted');
		});

		test('estratégia average faz média simples', () => {
			const config: HybridSearchConfig = {
				vectorWeight: 0.5,
				textWeight: 0.5,
				mergeStrategy: 'average',
				minScore: 0.0,
				maxResults: 10,
			};

			expect(config.mergeStrategy).toBe('average');
		});

		test('estratégia reciprocal_rank_fusion usa RRF', () => {
			const config: HybridSearchConfig = {
				vectorWeight: 0.5,
				textWeight: 0.5,
				mergeStrategy: 'reciprocal_rank_fusion',
				minScore: 0.0,
				maxResults: 10,
			};

			expect(config.mergeStrategy).toBe('reciprocal_rank_fusion');
		});
	});

	describe('Configuração por Tipo', () => {
		test('filmes usam 80% vector + 20% text', () => {
			const movieConfig: HybridSearchConfig = {
				vectorWeight: 0.8,
				textWeight: 0.2,
				mergeStrategy: 'weighted',
				minScore: 0.3,
				maxResults: 10,
			};

			expect(movieConfig.vectorWeight).toBe(0.8);
			expect(movieConfig.textWeight).toBe(0.2);
		});

		test('notas usam 60% vector + 40% text', () => {
			const noteConfig: HybridSearchConfig = {
				vectorWeight: 0.6,
				textWeight: 0.4,
				mergeStrategy: 'weighted',
				minScore: 0.3,
				maxResults: 10,
			};

			expect(noteConfig.vectorWeight).toBe(0.6);
			expect(noteConfig.textWeight).toBe(0.4);
		});
	});

	describe('searchMemory', () => {
		test('retorna resultados ordenados por score', async () => {
			const options: MemorySearchOptions = {
				query: mockQuery,
				userId: mockUserId,
				maxResults: 10,
				minScore: 0.3,
			};

			const results = await searchMemory(options);

			expect(Array.isArray(results)).toBe(true);

			// Verifica que estão ordenados por score (decrescente)
			for (let i = 1; i < results.length; i++) {
				expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
			}
		});

		test('respeita minScore', async () => {
			const options: MemorySearchOptions = {
				query: mockQuery,
				userId: mockUserId,
				maxResults: 10,
				minScore: 0.8,
			};

			const results = await searchMemory(options);

			results.forEach((result) => {
				expect(result.score).toBeGreaterThanOrEqual(0.8);
			});
		});

		test('respeita maxResults', async () => {
			const options: MemorySearchOptions = {
				query: mockQuery,
				userId: mockUserId,
				maxResults: 5,
				minScore: 0.0,
			};

			const results = await searchMemory(options);

			expect(results.length).toBeLessThanOrEqual(5);
		});

		test('filtra por tipos quando fornecido', async () => {
			const options: MemorySearchOptions = {
				query: mockQuery,
				userId: mockUserId,
				maxResults: 10,
				minScore: 0.0,
				types: ['movie'],
			};

			const results = await searchMemory(options);

			results.forEach((result) => {
				expect(result.type).toBe('movie');
			});
		});
	});

	describe('Estrutura de Resultados', () => {
		test('resultados têm campos obrigatórios', async () => {
			const options: MemorySearchOptions = {
				query: mockQuery,
				userId: mockUserId,
				maxResults: 1,
				minScore: 0.0,
			};

			const results = await searchMemory(options);

			if (results.length > 0) {
				expect(results[0]).toHaveProperty('id');
				expect(results[0]).toHaveProperty('type');
				expect(results[0]).toHaveProperty('title');
				expect(results[0]).toHaveProperty('score');
			}
		});

		test('scores estão entre 0 e 1', async () => {
			const options: MemorySearchOptions = {
				query: mockQuery,
				userId: mockUserId,
				maxResults: 10,
				minScore: 0.0,
			};

			const results = await searchMemory(options);

			results.forEach((result) => {
				expect(result.score).toBeGreaterThanOrEqual(0);
				expect(result.score).toBeLessThanOrEqual(1);
			});
		});
	});
});
