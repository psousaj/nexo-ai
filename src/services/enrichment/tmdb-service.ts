import { env } from '@/config/env';
import type { MovieMetadata, TVShowMetadata } from '@/types';

export interface TMDBMovie {
	id: number;
	title: string;
	release_date: string;
	vote_average: number;
	genre_ids: number[];
	poster_path: string | null;
}

interface TMDBMovieDetails {
	id: number;
	title: string;
	release_date: string;
	vote_average: number;
	genres: Array<{ id: number; name: string }>;
	poster_path: string | null;
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
	genre_ids: number[];
	poster_path: string | null;
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
		const url = new URL(`${this.baseUrl}/search/movie`);
		url.searchParams.set('api_key', this.apiKey);
		url.searchParams.set('query', query);
		url.searchParams.set('language', 'pt-BR');

		const response = await fetch(url.toString());

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.statusText}`);
		}

		const data = (await response.json()) as { results: TMDBMovie[] };
		return data.results || [];
	}

	/**
	 * Busca séries por título
	 */
	async searchTVShows(query: string): Promise<TMDBTVShow[]> {
		const url = new URL(`${this.baseUrl}/search/tv`);
		url.searchParams.set('api_key', this.apiKey);
		url.searchParams.set('query', query);
		url.searchParams.set('language', 'pt-BR');

		const response = await fetch(url.toString());

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.statusText}`);
		}

		const data = (await response.json()) as { results: TMDBTVShow[] };
		return data.results || [];
	}

	/**
	 * Busca detalhes completos de um filme
	 */
	async getMovieDetails(tmdbId: number): Promise<TMDBMovieDetails> {
		const url = new URL(`${this.baseUrl}/movie/${tmdbId}`);
		url.searchParams.set('api_key', this.apiKey);
		url.searchParams.set('language', 'pt-BR');
		url.searchParams.set('append_to_response', 'credits');

		const response = await fetch(url.toString());

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.statusText}`);
		}

		return (await response.json()) as TMDBMovieDetails;
	}

	/**
	 * Busca detalhes completos de uma série
	 */
	async getTVShowDetails(tmdbId: number): Promise<TMDBTVShowDetails> {
		const url = new URL(`${this.baseUrl}/tv/${tmdbId}`);
		url.searchParams.set('api_key', this.apiKey);
		url.searchParams.set('language', 'pt-BR');
		url.searchParams.set('append_to_response', 'credits');

		const response = await fetch(url.toString());

		if (!response.ok) {
			throw new Error(`TMDB API error: ${response.statusText}`);
		}

		return (await response.json()) as TMDBTVShowDetails;
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

		return {
			tmdb_id: details.id,
			year: parseInt(details.release_date?.split('-')[0] || '0'),
			genres: details.genres.map((g) => g.name),
			rating: Math.round(details.vote_average * 10) / 10,
			poster_url: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : undefined,
			director: director?.name,
			cast,
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

		return {
			tmdb_id: details.id,
			first_air_date: parseInt(details.first_air_date?.split('-')[0] || '0'),
			last_air_date: details.last_air_date ? parseInt(details.last_air_date.split('-')[0]) : undefined,
			number_of_seasons: details.number_of_seasons,
			number_of_episodes: details.number_of_episodes,
			status: details.status,
			genres: details.genres.map((g) => g.name),
			rating: Math.round(details.vote_average * 10) / 10,
			poster_url: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : undefined,
			created_by: details.created_by?.map((c) => c.name),
			cast,
		};
	}

	/**
	 * Busca provedores de streaming disponíveis (Brasil)
	 * @param tmdbId - ID do conteúdo no TMDB
	 * @param type - "movie" ou "tv"
	 */
	async getStreamingProviders(
		tmdbId: number,
		type: 'movie' | 'tv' = 'movie'
	): Promise<
		Array<{
			provider_id: number;
			provider_name: string;
			logo_path: string;
			type: 'flatrate' | 'rent' | 'buy';
		}>
	> {
		const url = new URL(`${this.baseUrl}/${type}/${tmdbId}/watch/providers`);
		url.searchParams.set('api_key', this.apiKey);

		const response = await fetch(url.toString());

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

		return providers;
	}
}

export const tmdbService = new TMDBService();
