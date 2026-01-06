import { env } from "@/config/env";
import type { MovieMetadata } from "@/types";

interface TMDBMovie {
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

export class TMDBService {
  private baseUrl = "https://api.themoviedb.org/3";
  private apiKey = env.TMDB_API_KEY;

  /**
   * Busca filmes por título
   */
  async searchMovies(query: string): Promise<TMDBMovie[]> {
    const url = new URL(`${this.baseUrl}/search/movie`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("query", query);
    url.searchParams.set("language", "pt-BR");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  }

  /**
   * Busca detalhes completos de um filme
   */
  async getMovieDetails(tmdbId: number): Promise<TMDBMovieDetails> {
    const url = new URL(`${this.baseUrl}/movie/${tmdbId}`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("language", "pt-BR");
    url.searchParams.set("append_to_response", "credits");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Converte resultado TMDB para MovieMetadata
   */
  async enrichMovie(tmdbId: number): Promise<MovieMetadata> {
    const details = await this.getMovieDetails(tmdbId);

    const director = details.credits?.crew.find((c) => c.job === "Director");
    const cast = details.credits?.cast
      .sort((a, b) => a.order - b.order)
      .slice(0, 5)
      .map((c) => c.name);

    return {
      tmdb_id: details.id,
      year: parseInt(details.release_date?.split("-")[0] || "0"),
      genres: details.genres.map((g) => g.name),
      rating: Math.round(details.vote_average * 10) / 10,
      poster_url: details.poster_path
        ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
        : undefined,
      director: director?.name,
      cast,
    };
  }
}

export const tmdbService = new TMDBService();
