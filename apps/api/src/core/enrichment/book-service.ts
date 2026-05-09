import { env } from '@/config/env';
import type { BookMetadata } from '@/types/enrichment';
import { loggers } from '@/utils/logger';
import { cacheGet, cacheSet } from './cache';

const CACHE_TTL = 86400;

interface GoogleBooksVolume {
	id: string;
	volumeInfo: {
		title: string;
		authors?: string[];
		publishedDate?: string;
		publisher?: string;
		pageCount?: number;
		categories?: string[];
		description?: string;
		imageLinks?: { thumbnail?: string; smallThumbnail?: string };
		industryIdentifiers?: Array<{ type: string; identifier: string }>;
	};
}

export class BookService {
	private readonly apiKey = env.GOOGLE_BOOKS_API_KEY;
	private readonly baseUrl = 'https://www.googleapis.com/books/v1';

	async searchBook(title: string, author?: string): Promise<BookMetadata | null> {
		if (!this.apiKey) {
			loggers.app.warn('GOOGLE_BOOKS_API_KEY não configurada — enrichment desabilitado');
			return null;
		}

		const cacheKey = `book:${title}:${author ?? ''}`.toLowerCase().replace(/\s+/g, '_');
		const cached = await cacheGet<BookMetadata>(cacheKey);
		if (cached) return cached;

		try {
			const q = author ? `intitle:"${title}" inauthor:"${author}"` : `intitle:"${title}"`;
			const params = new URLSearchParams({
				q,
				maxResults: '1',
				printType: 'books',
				key: this.apiKey,
			});
			const url = `${this.baseUrl}/volumes?${params}`;

			const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
			if (!res.ok) {
				loggers.app.warn({ status: res.status }, '📚 Google Books API retornou erro');
				return null;
			}

			const data = (await res.json()) as { items?: GoogleBooksVolume[] };
			const item = data.items?.[0];
			if (!item) return null;

			const info = item.volumeInfo;
			const isbn =
				info.industryIdentifiers?.find((id) => id.type === 'ISBN_13')?.identifier ??
				info.industryIdentifiers?.find((id) => id.type === 'ISBN_10')?.identifier;

			const metadata: BookMetadata = {
				title: info.title,
				author: info.authors?.[0] ?? '',
				isbn,
				publisher: info.publisher,
				pageCount: info.pageCount,
			};

			await cacheSet(cacheKey, metadata, CACHE_TTL);
			return metadata;
		} catch (error) {
			loggers.app.error({ err: error }, '📚 Erro ao buscar livro no Google Books');
			return null;
		}
	}
}

export const bookService = new BookService();
