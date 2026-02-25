import { env } from '@/config/env';
import { cacheGet, cacheSet } from '@/config/redis';
import { instrumentService } from '@/services/service-instrumentation';
import { enrichmentQueue } from '@/services/queue-service';
import type { MovieMetadata, TVShowMetadata } from '@/types';
import { loggers } from '@/utils/logger';
import { fetchWithRetry } from '@/utils/retry';

export interface TMDBMovie {
	id: number;
	title: string;
	release_date: string;
	year?: number;
	vote_average: number;
	rating?: number;
	genre_ids: number[];
	poster_path: string | null;
	overview?: string;
}

interface TMDBMovieDetails {
	id: number;
	title: string;
	release_date: string;
	vote_average: number;
	genres: Array<{ id: number; name: string }>;
	poster_path: string | null;
	overview?: string;
	tagline?: string;
	keywords?: {
		keywords: Array<{ id: number; name: string }>;
	};
	credits?: {
		crew: Array<{ job: string; name: string }>;
		cast: Array<{ name: string; order: number }>;
	};
}

export interface TMDBTVShow {
	id: number;
	name: string;
	first_air_date: string;
	vote_average: number;
	rating?: number;
	genre_ids: number[];
	poster_path: string | null;
	overview?: string;
}

interface TMDBTVShowDetails {
	id: number;
	name: string;
	first_air_date: string;
	last_air_date?: string;
	number_of_seasons: number;
	number_of_episodes: number;
	status: string;
	vote_average: number;
	genres: Array<{ id: number; name: string }>;
	poster_path: string | null;
	overview?: string;
	tagline?: string;
	keywords?: {
		results: Array<{ id: number; name: string }>;
	};
	created_by: Array<{ name: string }>;
	credits?: {
		cast: Array<{ name: string; order: number }>;
	};
}

export class TMDBService {
	private baseUrl = 'https://api.themoviedb.org/3';
	private apiKey = env.TMDB_API_KEY;

	/**
	 * Busca filmes por título
	 */
	async searchMovies(query: string): Promise<TMDBMovie[]> {
		const cacheKey = `tmdb:search:movie:${query.toLowerCase()}`;

		// Tenta cache primeiro
		const cached = await cacheGet<TMDBMovie[]>(cacheKey);
		if (cached) {
			loggers.enrichment.debug(`Cache hit: ${cacheKey}`);
			return cached;
		}

		const url = new URL(`${this.baseUrl}/search/movie`);
		url.searchParams.set('api_key', this.apiKey);
		url.searchParams.set('query', query);
		url.searchParams.set('language', 'pt-BR');

		const response = await fetchWithRetry(url.toString(), undefined, {
			maxRetries: 2,
			delayMs: 500,
		});

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.statusText}`);
		}

		const data = (await response.json()) as { results: TMDBMovie[] };
		const results = data.results || [];

		// Cache por 24h
		await cacheSet(cacheKey, results, 86400);

		// Bulk Enrichment Job (fire-and-forget)
		if (results.length > 0) {
			loggers.enrichment.debug({ count: results.length }, '🚀 Disparando bulk enrichment para filmes');
			enrichmentQueue.add('bulk-enrich-candidates', {
				candidates: results,
				provider: 'tmdb',
				type: 'movie',
			});
		}

		return results;
	}

	/**
	 * Busca séries por título
	 */
	async searchTVShows(query: string): Promise<TMDBTVShow[]> {
		const cacheKey = `tmdb:search:tv:${query.toLowerCase()}`;

		// Tenta cache primeiro
		const cached = await cacheGet<TMDBTVShow[]>(cacheKey);
		if (cached) {
			loggers.enrichment.debug(`Cache hit: ${cacheKey}`);
			return cached;
		}

		const url = new URL(`${this.baseUrl}/search/tv`);
		url.searchParams.set('api_key', this.apiKey);
		url.searchParams.set('query', query);
		url.searchParams.set('language', 'pt-BR');

		const response = await fetchWithRetry(url.toString(), undefined, {
			maxRetries: 2,
			delayMs: 500,
		});

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.statusText}`);
		}

		const data = (await response.json()) as { results: TMDBTVShow[] };
		const results = data.results || [];

		// Cache por 24h
		await cacheSet(cacheKey, results, 86400);

		// Bulk Enrichment Job (fire-and-forget)
		if (results.length > 0) {
			loggers.enrichment.debug({ count: results.length }, '🚀 Disparando bulk enrichment para sÃ©ries');
			enrichmentQueue.add('bulk-enrich-candidates', {
				candidates: results,
				provider: 'tmdb',
				type: 'tv_show',
			});
		}

		return results;
	}

	/**
	 * Busca detalhes completos de um filme
	 */
	async getMovieDetails(tmdbId: number): Promise<TMDBMovieDetails> {
		const cacheKey = `tmdb:movie:${tmdbId}`;

		// Tenta cache primeiro
		const cached = await cacheGet<TMDBMovieDetails>(cacheKey);
		if (cached) {
			loggers.enrichment.debug(`Cache hit: ${cacheKey}`);
			return cached;
		}

		const url = new URL(`${this.baseUrl}/movie/${tmdbId}`);
		url.searchParams.set('api_key', this.apiKey);
		url.searchParams.set('language', 'pt-BR');
		url.searchParams.set('append_to_response', 'credits,keywords'); // 🔥 keywords adicionado

		const response = await fetchWithRetry(url.toString(), undefined, {
			maxRetries: 2,
			delayMs: 500,
		});

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.statusText}`);
		}

		const details = (await response.json()) as TMDBMovieDetails;

		// Cache por 24h
		await cacheSet(cacheKey, details, 86400);

		return details;
	}

	/**
	 * Busca detalhes completos de uma série
	 */
	async getTVShowDetails(tmdbId: number): Promise<TMDBTVShowDetails> {
		const cacheKey = `tmdb:tv:${tmdbId}`;

		// Tenta cache primeiro
		const cached = await cacheGet<TMDBTVShowDetails>(cacheKey);
		if (cached) {
			loggers.enrichment.debug(`Cache hit: ${cacheKey}`);
			return cached;
		}

		const url = new URL(`${this.baseUrl}/tv/${tmdbId}`);
		url.searchParams.set('api_key', this.apiKey);
		url.searchParams.set('language', 'pt-BR');
		url.searchParams.set('append_to_response', 'credits,keywords'); // 🔥 keywords adicionado

		const response = await fetchWithRetry(url.toString(), undefined, {
			maxRetries: 2,
			delayMs: 500,
		});

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.statusText}`);
		}

		const details = (await response.json()) as TMDBTVShowDetails;

		// Cache por 24h
		await cacheSet(cacheKey, details, 86400);

		return details;
	}

	/**
	 * Converte resultado TMDB para MovieMetadata
	 */
	async enrichMovie(tmdbId: number): Promise<MovieMetadata> {
		const details = await this.getMovieDetails(tmdbId);

		const director = details.credits?.crew.find((c) => c.job === 'Director');
		const cast = details.credits?.cast
			.sort((a, b) => a.order - b.order)
			.slice(0, 5)
			.map((c) => c.name);

		// 🔥 Extrai keywords (crítico para busca semântica)
		const keywords = details.keywords?.keywords?.map((k) => k.name) || [];

		return {
			tmdb_id: details.id,
			year: Number.parseInt(details.release_date?.split('-')[0] || '0'),
			genres: details.genres.map((g) => g.name),
			rating: Math.round(details.vote_average * 10) / 10,
			poster_url: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : undefined,
			director: director?.name,
			cast,
			// 🔥 Campos semânticos
			overview: details.overview,
			tagline: details.tagline,
			keywords: keywords.length > 0 ? keywords : undefined,
		};
	}

	/**
	 * Converte resultado TMDB para TVShowMetadata
	 */
	async enrichTVShow(tmdbId: number): Promise<TVShowMetadata> {
		const details = await this.getTVShowDetails(tmdbId);

		const cast = details.credits?.cast
			.sort((a, b) => a.order - b.order)
			.slice(0, 5)
			.map((c) => c.name);

		// 🔥 Extrai keywords (crítico para busca semântica)
		const keywords = details.keywords?.results?.map((k) => k.name) || [];

		return {
			tmdb_id: details.id,
			first_air_date: Number.parseInt(details.first_air_date?.split('-')[0] || '0'),
			last_air_date: details.last_air_date ? Number.parseInt(details.last_air_date.split('-')[0]) : undefined,
			number_of_seasons: details.number_of_seasons,
			number_of_episodes: details.number_of_episodes,
			status: details.status,
			genres: details.genres.map((g) => g.name),
			rating: Math.round(details.vote_average * 10) / 10,
			poster_url: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : undefined,
			created_by: details.created_by?.map((c) => c.name),
			cast,
			// 🔥 Campos semânticos
			overview: details.overview,
			tagline: details.tagline,
			keywords: keywords.length > 0 ? keywords : undefined,
		};
	}

	/**
	 * Busca provedores de streaming disponíveis (Brasil)
	 * @param tmdbId - ID do conteúdo no TMDB
	 * @param type - "movie" ou "tv"
	 */
	async getStreamingProviders(
		tmdbId: number,
		type: 'movie' | 'tv' = 'movie',
	): Promise<
		Array<{
			provider_id: number;
			provider_name: string;
			logo_path: string;
			type: 'flatrate' | 'rent' | 'buy';
		}>
	> {
		const cacheKey = `tmdb:streaming:${type}:${tmdbId}`;

		// Tenta cache primeiro
		const cached = await cacheGet<
			Array<{
				provider_id: number;
				provider_name: string;
				logo_path: string;
				type: 'flatrate' | 'rent' | 'buy';
			}>
		>(cacheKey);
		if (cached) {
			loggers.enrichment.debug(`Cache hit: ${cacheKey}`);
			return cached;
		}

		const url = new URL(`${this.baseUrl}/${type}/${tmdbId}/watch/providers`);
		url.searchParams.set('api_key', this.apiKey);

		const response = await fetchWithRetry(url.toString(), undefined, {
			maxRetries: 2,
			delayMs: 500,
		});

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.statusText}`);
		}

		const data = (await response.json()) as { results?: { BR?: any } };

		// Busca providers do Brasil (BR)
		const brProviders = data.results?.BR;

		if (!brProviders) {
			return [];
		}

		const providers: Array<{
			provider_id: number;
			provider_name: string;
			logo_path: string;
			type: 'flatrate' | 'rent' | 'buy';
		}> = [];

		// Flatrate = streaming incluído (Netflix, Prime, etc)
		if (brProviders.flatrate) {
			brProviders.flatrate.forEach((p: any) => {
				providers.push({
					provider_id: p.provider_id,
					provider_name: p.provider_name,
					logo_path: `https://image.tmdb.org/t/p/original${p.logo_path}`,
					type: 'flatrate',
				});
			});
		}

		// Rent = aluguel
		if (brProviders.rent) {
			brProviders.rent.forEach((p: any) => {
				providers.push({
					provider_id: p.provider_id,
					provider_name: p.provider_name,
					logo_path: `https://image.tmdb.org/t/p/original${p.logo_path}`,
					type: 'rent',
				});
			});
		}

		// Buy = compra
		if (brProviders.buy) {
			brProviders.buy.forEach((p: any) => {
				providers.push({
					provider_id: p.provider_id,
					provider_name: p.provider_name,
					logo_path: `https://image.tmdb.org/t/p/original${p.logo_path}`,
					type: 'buy',
				});
			});
		}

		// Cache por 24h
		await cacheSet(cacheKey, providers, 86400);

		return providers;
	}
}

export const tmdbService = instrumentService('tmdb', new TMDBService());
