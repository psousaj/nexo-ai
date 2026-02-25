import type { ItemMetadata, ItemType } from '@/types';
import { loggers } from '@/utils/logger';
import { openGraphService } from './opengraph-service';
import { tmdbService } from './tmdb-service';
import { youtubeService } from './youtube-service';
import { instrumentService } from '@/services/service-instrumentation';

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

				default:
					return null;
			}
		} catch (error) {
			loggers.enrichment.error({ err: error, type }, 'Erro ao enriquecer');
			return null;
		}
	}

	/**
	 * Busca filmes no TMDB
	 */
	async searchMovies(query: string) {
		return tmdbService.searchMovies(query);
	}

	/**
	 * Busca séries no TMDB
	 */
	async searchTVShows(query: string) {
		return tmdbService.searchTVShows(query);
	}

	/**
	 * Busca provedores de streaming para um filme ou série
	 */
	async getStreamingProviders(tmdbId: number, type: 'movie' | 'tv' = 'movie') {
		return tmdbService.getStreamingProviders(tmdbId, type);
	}
}

export const enrichmentService = instrumentService('enrichment', new EnrichmentService());
