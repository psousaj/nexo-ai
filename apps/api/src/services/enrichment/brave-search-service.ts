import { env } from '@/config/env';
import { instrumentService } from '@/services/service-instrumentation';
import { loggers } from '@/utils/logger';

export interface BraveSearchResult {
	title: string;
	url: string;
	description: string;
	age?: string; // e.g. "1 day ago"
}

const BRAVE_SEARCH_API_URL = 'https://api.search.brave.com/res/v1/web/search';

class BraveSearchService {
	private readonly apiKey = env.BRAVE_SEARCH_API_KEY;

	async search(query: string, count = 5): Promise<BraveSearchResult[]> {
		if (!this.apiKey) {
			loggers.enrichment.warn('BRAVE_SEARCH_API_KEY não configurada — web_search desabilitado');
			return [];
		}

		try {
			const url = new URL(BRAVE_SEARCH_API_URL);
			url.searchParams.set('q', query);
			url.searchParams.set('count', String(Math.min(count, 10)));

			const res = await fetch(url.toString(), {
				headers: {
					Accept: 'application/json',
					'Accept-Encoding': 'gzip',
					'X-Subscription-Token': this.apiKey,
				},
				signal: AbortSignal.timeout(10000),
			});

			if (!res.ok) {
				loggers.enrichment.warn({ status: res.status }, '🔍 Brave Search API retornou erro');
				return [];
			}

			const data = (await res.json()) as {
				web?: {
					results?: Array<{
						title: string;
						url: string;
						description?: string;
						age?: string;
					}>;
				};
			};

			const results = data.web?.results ?? [];

			return results.slice(0, count).map((r) => ({
				title: this.sanitize(r.title),
				url: r.url,
				description: this.sanitize(r.description ?? ''),
				age: r.age,
			}));
		} catch (error) {
			loggers.enrichment.error({ err: error }, '🔍 Erro ao buscar no Brave Search');
			return [];
		}
	}

	/**
	 * Sanitiza strings para evitar prompt injection via snippets da web
	 */
	private sanitize(text: string): string {
		return text
			.replace(/[<>]/g, '') // remove HTML tags
			.replace(/\n+/g, ' ') // normaliza quebras de linha
			.substring(0, 300) // limita tamanho
			.trim();
	}
}

export const braveSearchService = instrumentService('brave-search', new BraveSearchService());
