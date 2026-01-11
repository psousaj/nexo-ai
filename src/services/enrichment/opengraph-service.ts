import type { LinkMetadata } from "@/types";

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
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NexoAI/1.0)",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const og = this.parseOpenGraph(html);
      const domain = new URL(url).hostname;

      return {
        url,
        og_title: og.ogTitle,
        og_description: og.ogDescription,
        og_image: og.ogImage,
        domain,
      };
    } catch (error) {
      // Fallback em caso de erro
      return {
        url,
        domain: new URL(url).hostname,
      };
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
