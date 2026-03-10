/**
 * Testes unitários para ImageMetadataService (enrichment)
 *
 * Valida:
 * - Extrai content-type e content-length via HEAD request
 * - Mapeia MIME types para formato legível
 * - Extrai domínio corretamente da URL
 * - Retorna null em erro HTTP
 * - Retorna null quando fetch falha (timeout, rede)
 * - Função sem cache (stateless)
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================
vi.mock('@/utils/logger', () => ({
	loggers: {
		app: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
	},
}));

vi.mock('@/services/service-instrumentation', () => ({
	instrumentService: (_name: string, service: unknown) => service,
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ============================================================================
// Import após mocks
// ============================================================================
const { imageMetadataService: service } = await import('@/services/enrichment/image-metadata-service');

function makeFetchResponse(opts: {
	ok?: boolean;
	status?: number;
	contentType?: string;
	contentLength?: string;
}) {
	return {
		ok: opts.ok ?? true,
		status: opts.status ?? 200,
		headers: {
			get: (header: string) => {
				if (header === 'content-type') return opts.contentType ?? null;
				if (header === 'content-length') return opts.contentLength ?? null;
				return null;
			},
		},
	};
}

describe('ImageMetadataService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('extractMetadata', () => {
		test('extrai url, domínio, formato e tamanho corretamente', async () => {
			mockFetch.mockResolvedValueOnce(
				makeFetchResponse({
					contentType: 'image/jpeg',
					contentLength: '204800',
				}),
			);

			const result = await service.extractMetadata('https://example.com/photo.jpg');

			expect(result).not.toBeNull();
			expect(result?.url).toBe('https://example.com/photo.jpg');
			expect(result?.source_domain).toBe('example.com');
			expect(result?.format).toBe('jpeg');
			expect(result?.size_bytes).toBe(204800);
		});

		test('usa método HEAD na request', async () => {
			mockFetch.mockResolvedValueOnce(makeFetchResponse({ contentType: 'image/png' }));

			await service.extractMetadata('https://cdn.example.com/img.png');

			expect(mockFetch).toHaveBeenCalledWith(
			'https://cdn.example.com/img.png',
			expect.objectContaining({ method: 'HEAD' }),
		);
		});

		test('mapeia image/png → png', async () => {
			mockFetch.mockResolvedValueOnce(makeFetchResponse({ contentType: 'image/png' }));
			const result = await service.extractMetadata('https://example.com/img.png');
			expect(result?.format).toBe('png');
		});

		test('mapeia image/webp → webp', async () => {
			mockFetch.mockResolvedValueOnce(makeFetchResponse({ contentType: 'image/webp' }));
			const result = await service.extractMetadata('https://example.com/img.webp');
			expect(result?.format).toBe('webp');
		});

		test('mapeia image/gif → gif', async () => {
			mockFetch.mockResolvedValueOnce(makeFetchResponse({ contentType: 'image/gif' }));
			const result = await service.extractMetadata('https://example.com/img.gif');
			expect(result?.format).toBe('gif');
		});

		test('mapeia image/svg+xml → svg', async () => {
			mockFetch.mockResolvedValueOnce(makeFetchResponse({ contentType: 'image/svg+xml' }));
			const result = await service.extractMetadata('https://example.com/img.svg');
			expect(result?.format).toBe('svg');
		});

		test('retorna format undefined para MIME type desconhecido', async () => {
			mockFetch.mockResolvedValueOnce(
				makeFetchResponse({ contentType: 'application/octet-stream' }),
			);
			const result = await service.extractMetadata('https://example.com/file.bin');
			expect(result?.format).toBeUndefined();
		});

		test('size_bytes é undefined quando content-length não está presente', async () => {
			mockFetch.mockResolvedValueOnce(
				makeFetchResponse({ contentType: 'image/jpeg', contentLength: undefined }),
			);
			const result = await service.extractMetadata('https://example.com/photo.jpg');
			expect(result?.size_bytes).toBeUndefined();
		});

		test('retorna null quando HEAD request falha (status 404)', async () => {
			mockFetch.mockResolvedValueOnce(makeFetchResponse({ ok: false, status: 404 }));
			const result = await service.extractMetadata('https://example.com/missing.jpg');
			expect(result).toBeNull();
		});

		test('retorna null e não lança quando fetch lança exceção', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network timeout'));
			const result = await service.extractMetadata('https://example.com/photo.jpg');
			expect(result).toBeNull();
		});

		test('extrai domínio de URLs com subdomínio', async () => {
			mockFetch.mockResolvedValueOnce(makeFetchResponse({ contentType: 'image/jpeg' }));
			const result = await service.extractMetadata('https://cdn.photos.example.com/img.jpg');
			expect(result?.source_domain).toBe('cdn.photos.example.com');
		});
	});
});
