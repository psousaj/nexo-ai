import { env } from '@/config/env';
import type { MovieMetadata, TVShowMetadata } from '@/types/enrichment';
import { loggers } from '@/utils/logger';
import { fetchWithRetry } from '@/utils/retry';
import { cacheGet, cacheSet } from './cache';

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

	async searchMovies(query: string, year?: number): Promise<TMDBMovie[]> {
		if (!this.apiKey) {
			loggers.enrichment.warn('TMDB_API_KEY não configurada — searchMovies desabilitado');
			return [];
		}

		const cacheKey = `tmdb:search:movie:${query.toLowerCase()}${year ? `:${year}` : ''}`;

		const cached = await cacheGet<TMDBMovie[]>(cacheKey);
		if (cached) {
			loggers.enrichment.debug(`Cache hit: ${cacheKey}`);
			return cached;
		}

		const url = new URL(`${this.baseUrl}/search/movie`);
		url.searchParams.set('api_key', this.apiKey);
		url.searchParams.set('query', query);
		url.searchParams.set('language', 'pt-BR');
		if (year) url.searchParams.set('primary_release_year', String(year));

		const response = await fetchWithRetry(url.toString(), undefined, {
			maxRetries: 2,
			delayMs: 500,
		});

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.statusText}`);
		}

		const data = (await response.json()) as { results: TMDBMovie[] };
		const results = data.results || [];

		await cacheSet(cacheKey, results, 86400);

		return results;
	}

	async searchTVShows(query: string, year?: number): Promise<TMDBTVShow[]> {
		if (!this.apiKey) {
			loggers.enrichment.warn('TMDB_API_KEY não configurada — searchTVShows desabilitado');
			return [];
		}

		const cacheKey = `tmdb:search:tv:${query.toLowerCase()}${year ? `:${year}` : ''}`;

		const cached = await cacheGet<TMDBTVShow[]>(cacheKey);
		if (cached) {
			loggers.enrichment.debug(`Cache hit: ${cacheKey}`);
			return cached;
		}

		const url = new URL(`${this.baseUrl}/search/tv`);
		url.searchParams.set('api_key', this.apiKey);
		url.searchParams.set('query', query);
		url.searchParams.set('language', 'pt-BR');
		if (year) url.searchParams.set('first_air_date_year', String(year));

		const response = await fetchWithRetry(url.toString(), undefined, {
			maxRetries: 2,
			delayMs: 500,
		});

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.statusText}`);
		}

		const data = (await response.json()) as { results: TMDBTVShow[] };
		const results = data.results || [];

		await cacheSet(cacheKey, results, 86400);

		return results;
	}

	async getMovieDetails(tmdbId: number): Promise<TMDBMovieDetails> {
		if (!this.apiKey) throw new Error('TMDB_API_KEY não configurada');

		const cacheKey = `tmdb:movie:${tmdbId}`;

		const cached = await cacheGet<TMDBMovieDetails>(cacheKey);
		if (cached) {
			loggers.enrichment.debug(`Cache hit: ${cacheKey}`);
			return cached;
		}

		const url = new URL(`${this.baseUrl}/movie/${tmdbId}`);
		url.searchParams.set('api_key', this.apiKey);
		url.searchParams.set('language', 'pt-BR');
		url.searchParams.set('append_to_response', 'credits,keywords');

		const response = await fetchWithRetry(url.toString(), undefined, {
			maxRetries: 2,
			delayMs: 500,
		});

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.statusText}`);
		}

		const details = (await response.json()) as TMDBMovieDetails;

		await cacheSet(cacheKey, details, 86400);

		return details;
	}

	async getTVShowDetails(tmdbId: number): Promise<TMDBTVShowDetails> {
		if (!this.apiKey) throw new Error('TMDB_API_KEY não configurada');

		const cacheKey = `tmdb:tv:${tmdbId}`;

		const cached = await cacheGet<TMDBTVShowDetails>(cacheKey);
		if (cached) {
			loggers.enrichment.debug(`Cache hit: ${cacheKey}`);
			return cached;
		}

		const url = new URL(`${this.baseUrl}/tv/${tmdbId}`);
		url.searchParams.set('api_key', this.apiKey);
		url.searchParams.set('language', 'pt-BR');
		url.searchParams.set('append_to_response', 'credits,keywords');

		const response = await fetchWithRetry(url.toString(), undefined, {
			maxRetries: 2,
			delayMs: 500,
		});

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.statusText}`);
		}

		const details = (await response.json()) as TMDBTVShowDetails;

		await cacheSet(cacheKey, details, 86400);

		return details;
	}

	async enrichMovie(tmdbId: number): Promise<MovieMetadata> {
		const details = await this.getMovieDetails(tmdbId);

		const director = details.credits?.crew.find((c) => c.job === 'Director');

		return {
			title: details.title,
			tmdbId: details.id,
			year: Number.parseInt(details.release_date?.split('-')[0] || '0'),
			genres: details.genres.map((g) => g.name),
			posterUrl: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : undefined,
			director: director?.name ?? '',
			overview: details.overview ?? '',
		};
	}

	async enrichTVShow(tmdbId: number): Promise<TVShowMetadata> {
		const details = await this.getTVShowDetails(tmdbId);

		return {
			title: details.name,
			tmdbId: details.id,
			firstAirYear: Number.parseInt(details.first_air_date?.split('-')[0] || '0'),
			genres: details.genres.map((g) => g.name),
			overview: details.overview ?? '',
		};
	}

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
		if (!this.apiKey) return [];

		const cacheKey = `tmdb:streaming:${type}:${tmdbId}`;

		const cached =
			await cacheGet<
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

		await cacheSet(cacheKey, providers, 86400);

		return providers;
	}
}

export const tmdbService = new TMDBService();
