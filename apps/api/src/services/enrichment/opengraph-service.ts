import type { LinkMetadata } from "@/types";
import { cacheGet, cacheSet } from '@/config/redis';
import { fetchWithRetry } from '@/utils/retry';
import { loggers } from '@/utils/logger';

interface OpenGraphData {
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
}

export class OpenGraphService {
  /**
   * Extrai OpenGraph metadata de uma URL
   */
  async fetchMetadata(url: string): Promise<LinkMetadata> {
    const cacheKey = `opengraph:${url}`;
    
    // Tenta cache primeiro
    const cached = await cacheGet<LinkMetadata>(cacheKey);
    if (cached) {
      loggers.enrichment.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    try {
      const response = await fetchWithRetry(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NexoAI/1.0)",
        },
      }, {
        maxRetries: 2,
        delayMs: 500,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const og = this.parseOpenGraph(html);
      const domain = new URL(url).hostname;

      const metadata: LinkMetadata = {
        url,
        og_title: og.ogTitle,
        og_description: og.ogDescription,
        og_image: og.ogImage,
        domain,
      };

      // Cache por 24h
      await cacheSet(cacheKey, metadata, 86400);

      return metadata;
    } catch (error) {
      // Fallback em caso de erro
      const fallback: LinkMetadata = {
        url,
        domain: new URL(url).hostname,
      };
      
      // Cache fallback por 1h apenas
      await cacheSet(cacheKey, fallback, 3600);
      
      return fallback;
    }
  }

  /**
   * Parse HTML para extrair meta tags OpenGraph
   */
  private parseOpenGraph(html: string): OpenGraphData {
    const og: OpenGraphData = {};

    // Regex para meta tags OpenGraph
    const metaRegex = /<meta\s+property="og:([^"]+)"\s+content="([^"]+)"/g;
    let match;

    while ((match = metaRegex.exec(html)) !== null) {
      const property = match[1];
      const content = match[2];

      switch (property) {
        case "title":
          og.ogTitle = content;
          break;
        case "description":
          og.ogDescription = content;
          break;
        case "image":
          og.ogImage = content;
          break;
        case "url":
          og.ogUrl = content;
          break;
      }
    }

    // Fallback para title regular se og:title não existir
    if (!og.ogTitle) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        og.ogTitle = titleMatch[1];
      }
    }

    return og;
  }
}

export const openGraphService = new OpenGraphService();
