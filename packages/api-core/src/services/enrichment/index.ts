import { instrumentService } from '@/services/service-instrumentation';
import type { ItemMetadata, ItemType } from '@/types';
import { loggers } from '@/utils/logger';
import { bookService } from './book-service';
import { imageMetadataService } from './image-metadata-service';
import { openGraphService } from './opengraph-service';
import { spotifyService } from './spotify-service';
import { tmdbService } from './tmdb-service';
import { youtubeService } from './youtube-service';

/**
 * Serviço unificado de enriquecimento
 */
export class EnrichmentService {
	/**
	 * Enriquece conteúdo baseado no tipo
	 */
	async enrich(type: ItemType, data: any): Promise<ItemMetadata | null> {
		try {
			switch (type) {
				case 'movie':
					if (data.tmdbId) {
						return await tmdbService.enrichMovie(data.tmdbId);
					}
					return null;

				case 'tv_show':
					if (data.tmdbId) {
						return await tmdbService.enrichTVShow(data.tmdbId);
					}
					return null;

				case 'video':
					if (data.url) {
						return await youtubeService.enrichYouTubeVideo(data.url);
					}
					return null;

				case 'link':
					if (data.url) {
						return await openGraphService.fetchMetadata(data.url);
					}
					return null;

				case 'note':
					// Notas não precisam de enriquecimento externo
					return data.metadata || {};

				case 'memo':
					// Memos são notas livres — sem enriquecimento externo
					return data.metadata || {};

				case 'book':
					if (data.title) {
						return await bookService.searchBook(data.title, data.author);
					}
					return null;

				case 'music':
					if (data.title) {
						return await spotifyService.searchTrack(data.title, data.artist);
					}
					return null;

				case 'image':
					if (data.url) {
						return await imageMetadataService.extractMetadata(data.url);
					}
					return null;

				default:
					return null;
			}
		} catch (error) {
			loggers.enrichment.error({ err: error, type }, 'Erro ao enriquecer');
			return null;
		}
	}

	/**
	 * Busca filmes no TMDB, com filtro opcional de ano
	 */
	async searchMovies(query: string, year?: number) {
		return tmdbService.searchMovies(query, year);
	}

	/**
	 * Busca séries no TMDB, com filtro opcional de ano
	 */
	async searchTVShows(query: string, year?: number) {
		return tmdbService.searchTVShows(query, year);
	}

	/**
	 * Busca provedores de streaming para um filme ou série
	 */
	async getStreamingProviders(tmdbId: number, type: 'movie' | 'tv' = 'movie') {
		return tmdbService.getStreamingProviders(tmdbId, type);
	}
}

export const enrichmentService = instrumentService('enrichment', new EnrichmentService());
