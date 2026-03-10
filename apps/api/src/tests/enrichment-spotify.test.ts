/**
 * Testes unitários para SpotifyService (enrichment)
 *
 * Valida:
 * - Retorna null quando credenciais não configuradas
 * - Cache hit de token → não busca novo token
 * - Cache hit de track → não chama API
 * - Fluxo completo: obtém token + busca track + mapeia campos
 * - Inclui artist na query quando fornecido
 * - Retorna null em erro HTTP na busca de token
 * - Retorna null em erro HTTP na busca de track
 * - Retorna null quando não há tracks
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================
const { mockCacheGet, mockCacheSet, mockEnv } = vi.hoisted(() => ({
	mockCacheGet: vi.fn(),
	mockCacheSet: vi.fn(),
	mockEnv: {
		SPOTIFY_CLIENT_ID: 'test-client-id',
		SPOTIFY_CLIENT_SECRET: 'test-client-secret',
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

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ============================================================================
// Import após mocks
// ============================================================================
const { spotifyService: service } = await import('@/services/enrichment/spotify-service');

const TRACK_RESPONSE = {
	tracks: {
		items: [
			{
				id: 'spotify123',
				name: 'Bohemian Rhapsody',
				artists: [{ name: 'Queen' }],
				album: {
					name: 'A Night at the Opera',
					images: [{ url: 'https://i.scdn.co/image/abc', width: 640, height: 640 }],
					release_date: '1975-11-21',
				},
				duration_ms: 354000,
				popularity: 92,
				external_urls: { spotify: 'https://open.spotify.com/track/spotify123' },
				preview_url: 'https://p.scdn.co/mp3-preview/abc',
			},
		],
	},
};

const TOKEN_RESPONSE = { access_token: 'fake-access-token' };

describe('SpotifyService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Por padrão: sem cache
		mockCacheGet.mockResolvedValue(null);
		mockCacheSet.mockResolvedValue(undefined);
	});

	test('usa token em cache sem chamar endpoint de token', async () => {
		// Primeiro mockCacheGet → token em cache; segundo → sem cache de track
		mockCacheGet
			.mockResolvedValueOnce(null) // track cache miss
			.mockResolvedValueOnce('cached-token'); // token cache hit

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => TRACK_RESPONSE,
		});

		await service.searchTrack('Bohemian Rhapsody');

		// Apenas 1 fetch (busca de track), nenhum para token
		expect(mockFetch).toHaveBeenCalledTimes(1);
		const url = mockFetch.mock.calls[0][0] as string;
		expect(url).toContain('api.spotify.com/v1/search');
	});

	test('retorna track em cache sem chamar fetch', async () => {
		const cached = { title: 'Bohemian Rhapsody', artist: 'Queen' };
		mockCacheGet.mockResolvedValueOnce(cached); // track cache hit

		const result = await service.searchTrack('Bohemian Rhapsody');

		expect(result).toEqual(cached);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	test('fluxo completo: obtém token e busca track', async () => {
		// cache miss para track e token
		mockCacheGet.mockResolvedValue(null);
		mockFetch
			.mockResolvedValueOnce({ ok: true, json: async () => TOKEN_RESPONSE }) // token
			.mockResolvedValueOnce({ ok: true, json: async () => TRACK_RESPONSE }); // track

		const result = await service.searchTrack('Bohemian Rhapsody');

		expect(result).not.toBeNull();
		expect(result?.title).toBe('Bohemian Rhapsody');
		expect(result?.artist).toBe('Queen');
		expect(result?.album).toBe('A Night at the Opera');
		expect(result?.year).toBe(1975);
		expect(result?.duration_ms).toBe(354000);
		expect(result?.popularity).toBe(92);
		expect(result?.spotify_id).toBe('spotify123');
		expect(result?.spotify_url).toBe('https://open.spotify.com/track/spotify123');
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	test('inclui artist na query quando fornecido', async () => {
		mockCacheGet.mockResolvedValue(null);
		mockFetch
			.mockResolvedValueOnce({ ok: true, json: async () => TOKEN_RESPONSE })
			.mockResolvedValueOnce({ ok: true, json: async () => TRACK_RESPONSE });

		await service.searchTrack('Bohemian Rhapsody', 'Queen');

		const searchUrl = mockFetch.mock.calls[1][0] as string;
		expect(searchUrl).toContain('artist');
		expect(searchUrl).toContain('Queen');
	});

	test('retorna null quando endpoint de token falha', async () => {
		mockCacheGet.mockResolvedValue(null);
		mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

		const result = await service.searchTrack('Qualquer Track');
		expect(result).toBeNull();
	});

	test('retorna null quando busca de track retorna erro HTTP', async () => {
		mockCacheGet.mockResolvedValue(null);
		mockFetch
			.mockResolvedValueOnce({ ok: true, json: async () => TOKEN_RESPONSE })
			.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });

		const result = await service.searchTrack('Qualquer Track');
		expect(result).toBeNull();
	});

	test('retorna null quando não há tracks no resultado', async () => {
		mockCacheGet.mockResolvedValue(null);
		mockFetch
			.mockResolvedValueOnce({ ok: true, json: async () => TOKEN_RESPONSE })
			.mockResolvedValueOnce({ ok: true, json: async () => ({ tracks: { items: [] } }) });

		const result = await service.searchTrack('Track Inexistente');
		expect(result).toBeNull();
	});

	test('salva token e track no cache com TTLs corretos', async () => {
		mockCacheGet.mockResolvedValue(null);
		mockFetch
			.mockResolvedValueOnce({ ok: true, json: async () => TOKEN_RESPONSE })
			.mockResolvedValueOnce({ ok: true, json: async () => TRACK_RESPONSE });

		await service.searchTrack('Bohemian Rhapsody');

		// Token salvo com ~58min TTL
		expect(mockCacheSet).toHaveBeenCalledWith('spotify:client_token', 'fake-access-token', 3500);
		// Track salvo com 24h TTL
		expect(mockCacheSet).toHaveBeenCalledWith(
			expect.stringContaining('music:'),
			expect.objectContaining({ title: 'Bohemian Rhapsody' }),
			86400,
		);
	});
});
