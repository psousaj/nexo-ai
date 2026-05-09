import type { LinkMetadata } from '@/types/enrichment';
import { loggers } from '@/utils/logger';
import { fetchWithRetry } from '@/utils/retry';
import { cacheGet, cacheSet } from './cache';

interface OpenGraphData {
	ogTitle?: string;
	ogDescription?: string;
	ogImage?: string;
	ogUrl?: string;
}

export class OpenGraphService {
	async fetchMetadata(url: string): Promise<LinkMetadata> {
		const cacheKey = `opengraph:${url}`;

		const cached = await cacheGet<LinkMetadata>(cacheKey);
		if (cached) {
			loggers.enrichment.debug(`Cache hit: ${cacheKey}`);
			return cached;
		}

		try {
			const response = await fetchWithRetry(
				url,
				{
					headers: {
						'User-Agent': 'Mozilla/5.0 (compatible; NexoAI/1.0)',
					},
				},
				{
					maxRetries: 2,
					delayMs: 500,
				},
			);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const html = await response.text();
			const og = this.parseOpenGraph(html);

			const metadata: LinkMetadata = {
				url,
				title: og.ogTitle,
				description: og.ogDescription,
				image: og.ogImage,
			};

			await cacheSet(cacheKey, metadata, 86400);

			return metadata;
		} catch (_error) {
			const fallback: LinkMetadata = {
				url,
			};

			await cacheSet(cacheKey, fallback, 3600);

			return fallback;
		}
	}

	private parseOpenGraph(html: string): OpenGraphData {
		const og: OpenGraphData = {};

		const metaRegex = /<meta\s+property="og:([^"]+)"\s+content="([^"]+)"/g;
		let match: RegExpExecArray | null;

		while ((match = metaRegex.exec(html)) !== null) {
			const property = match[1];
			const content = match[2];

			switch (property) {
				case 'title':
					og.ogTitle = content;
					break;
				case 'description':
					og.ogDescription = content;
					break;
				case 'image':
					og.ogImage = content;
					break;
				case 'url':
					og.ogUrl = content;
					break;
			}
		}

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
