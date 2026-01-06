import { tmdbService } from "./tmdb-service";
import { youtubeService } from "./youtube-service";
import { openGraphService } from "./opengraph-service";
import type { ItemType, ItemMetadata } from "@/types";

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
        case "movie":
          if (data.tmdbId) {
            return await tmdbService.enrichMovie(data.tmdbId);
          }
          return null;

        case "video":
          if (data.url) {
            return await youtubeService.enrichYouTubeVideo(data.url);
          }
          return null;

        case "link":
          if (data.url) {
            return await openGraphService.fetchMetadata(data.url);
          }
          return null;

        case "note":
          // Notas não precisam de enriquecimento externo
          return data.metadata || {};

        default:
          return null;
      }
    } catch (error) {
      console.error(`Erro ao enriquecer ${type}:`, error);
      return null;
    }
  }

  /**
   * Busca filmes no TMDB
   */
  async searchMovies(query: string) {
    return tmdbService.searchMovies(query);
  }
}

export const enrichmentService = new EnrichmentService();
