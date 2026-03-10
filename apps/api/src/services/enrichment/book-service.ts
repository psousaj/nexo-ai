import { env } from '@/config/env';
import { cacheGet, cacheSet } from '@/config/redis';
import { instrumentService } from '@/services/service-instrumentation';
import type { BookMetadata } from '@/types';
import { loggers } from '@/utils/logger';

const CACHE_TTL = 86400; // 24h

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

class BookService {
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
			// Aspas são necessárias para títulos/autores com múltiplas palavras
			// (sem aspas, apenas a primeira palavra seria escopo do qualificador intitle:/inauthor:)
			const q = author
				? `intitle:"${title}" inauthor:"${author}"`
				: `intitle:"${title}"`;
			const params = new URLSearchParams({
				q,
				maxResults: '1',
				printType: 'books', // exclui revistas
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

			const year = info.publishedDate ? Number(info.publishedDate.split('-')[0]) : undefined;

			const metadata: BookMetadata = {
				title: info.title,
				authors: info.authors ?? [],
				year: Number.isNaN(year) ? undefined : year,
				publisher: info.publisher,
				page_count: info.pageCount,
				genres: info.categories ?? [],
				description: info.description,
				cover_url: info.imageLinks?.thumbnail?.replace('http://', 'https://'),
				isbn,
				google_books_id: item.id,
			};

			await cacheSet(cacheKey, metadata, CACHE_TTL);
			return metadata;
		} catch (error) {
			loggers.app.error({ err: error }, '📚 Erro ao buscar livro no Google Books');
			return null;
		}
	}
}

export const bookService = instrumentService('book', new BookService());
