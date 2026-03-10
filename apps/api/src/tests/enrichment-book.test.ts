/**
 * Testes unitários para BookService (enrichment)
 *
 * Valida:
 * - Retorna null quando GOOGLE_BOOKS_API_KEY não está configurada
 * - Cache hit → retorna sem chamar fetch
 * - Busca com sucesso e mapeia campos corretamente
 * - Retorna null quando API retorna erro HTTP
 * - Retorna null quando não há resultados
 * - Inclui autor na query quando fornecido
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================
const { mockCacheGet, mockCacheSet, mockEnv } = vi.hoisted(() => ({
	mockCacheGet: vi.fn(),
	mockCacheSet: vi.fn(),
	mockEnv: {
		GOOGLE_BOOKS_API_KEY: 'test-api-key',
	},
}));

vi.mock('@/config/redis', () => ({
	cacheGet: mockCacheGet,
	cacheSet: mockCacheSet,
}));

vi.mock('@/config/env', () => ({
	env: mockEnv,
}));

vi.mock('@/utils/logger', () => ({
	loggers: {
		app: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
	},
}));

vi.mock('@/services/service-instrumentation', () => ({
	instrumentService: (_name: string, service: unknown) => service,
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ============================================================================
// Import após mocks
// ============================================================================
const { bookService: service } = await import('@/services/enrichment/book-service');

const BOOK_API_RESPONSE = {
	items: [
		{
			id: 'abc123',
			volumeInfo: {
				title: 'O Senhor dos Anéis',
				authors: ['J.R.R. Tolkien'],
				publishedDate: '1954-07-29',
				publisher: 'Allen & Unwin',
				pageCount: 1178,
				categories: ['Fantasy'],
				description: 'Uma épica aventura na Terra Média.',
				imageLinks: {
					thumbnail: 'http://books.google.com/thumbnail.jpg',
				},
				industryIdentifiers: [
					{ type: 'ISBN_13', identifier: '9780618640157' },
				],
			},
		},
	],
};

describe('BookService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCacheGet.mockResolvedValue(null);
		mockCacheSet.mockResolvedValue(undefined);
	});

	test('retorna cache quando disponível (cache hit)', async () => {
		const cached = { title: 'O Senhor dos Anéis', authors: ['J.R.R. Tolkien'] };
		mockCacheGet.mockResolvedValueOnce(cached);

		const result = await service.searchBook('O Senhor dos Anéis');

		expect(result).toEqual(cached);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	test('busca com sucesso e mapeia campos corretamente', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => BOOK_API_RESPONSE,
		});

		const result = await service.searchBook('O Senhor dos Anéis');

		expect(result).not.toBeNull();
		expect(result?.title).toBe('O Senhor dos Anéis');
		expect(result?.authors).toEqual(['J.R.R. Tolkien']);
		expect(result?.year).toBe(1954);
		expect(result?.publisher).toBe('Allen & Unwin');
		expect(result?.page_count).toBe(1178);
		expect(result?.genres).toEqual(['Fantasy']);
		expect(result?.isbn).toBe('9780618640157');
		expect(result?.google_books_id).toBe('abc123');
		// URL de capa deve usar HTTPS
		expect(result?.cover_url).toMatch(/^https:/);
	});

	test('inclui autor na query com aspas para multi-palavra', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => BOOK_API_RESPONSE,
		});

		await service.searchBook('O Senhor dos Anéis', 'J.R.R. Tolkien');

		expect(mockFetch).toHaveBeenCalledOnce();
		const url = mockFetch.mock.calls[0][0] as string;
		// query deve conter intitle:"..." inauthor:"..." com aspas para suportar multi-palavra
		expect(url).toContain('intitle%3A%22');
		expect(url).toContain('inauthor%3A%22');
		// printType=books obrigatório para excluir revistas
		expect(url).toContain('printType=books');
	});

	test('retorna null quando API retorna erro HTTP', async () => {
		mockFetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) });

		const result = await service.searchBook('Livro Qualquer');
		expect(result).toBeNull();
	});

	test('retorna null quando não há itens no resultado', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ items: [] }),
		});

		const result = await service.searchBook('Livro Inexistente');
		expect(result).toBeNull();
	});

	test('retorna null e não lança quando fetch falha', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Network error'));

		const result = await service.searchBook('Livro Error');
		expect(result).toBeNull();
	});

	test('salva resultado no cache com TTL de 24h', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => BOOK_API_RESPONSE,
		});

		await service.searchBook('O Senhor dos Anéis');

		expect(mockCacheSet).toHaveBeenCalledWith(
			expect.stringContaining('book:'),
			expect.objectContaining({ title: 'O Senhor dos Anéis' }),
			86400,
		);
	});
});
