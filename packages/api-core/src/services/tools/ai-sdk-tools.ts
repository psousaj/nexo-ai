/**
 * AI SDK Tool Definitions - Native Tool Calling
 *
 * Tools PURAS: mesma entrada -> mesma saida, sem branching interno.
 * Cada tool faz UMA coisa:
 *   - save_* -> SEMPRE salva (requer metadata completa ou parcial)
 *   - search_\*enrich_\* -> SEMPRE busca (retorna candidatos)
 *   - Parameter clamping silencioso (Math.min/max)
 *   - Input normalization (.trim(), normalize URLs)
 *   - Null vs Zero: null para indisponível, 0 para valor real
 *
 * Fluxo LLM para enrichables:
 *   1. LLM chama enrich_movie/search_book/search_music -> candidatos
 *   2. LLM apresenta candidatos ao usuário
 *   3. LLM chama save_movie/save_book/save_music com dados completos
 */

import { tool } from 'ai';
import { z } from 'zod';
import { itemService } from '@/services/item-service';
import { enrichmentService } from '@/services/enrichment';
import { bookService } from '@/services/enrichment/book-service';
import { braveSearchService } from '@/services/enrichment/brave-search-service';
import { openGraphService } from '@/services/enrichment/opengraph-service';
import { spotifyService } from '@/services/enrichment/spotify-service';
import { conversationService } from '@/services/conversation-service';
import { loggers } from '@/utils/logger';
import type {
	BookMetadata,
	ImageMetadata,
	LinkMetadata,
	MemoMetadata,
	MovieMetadata,
	MusicMetadata,
	NoteMetadata,
	TVShowMetadata,
	VideoMetadata,
} from '@/types';

// Re-export ToolContext for consumers
export interface ToolContext {
	userId: string;
	conversationId: string;
	provider?: 'telegram' | 'whatsapp' | 'discord';
	externalId?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Clamp numérico silencioso */
function clamp(val: number, min: number, max: number): number {
	return Math.min(Math.max(val, min), max);
}

/** Normaliza URL: adiciona https:// se necessário */
function normalizeUrl(url: string): string {
	const trimmed = url.trim();
	if (trimmed && !/^https?:\/\//i.test(trimmed)) {
		return `https://${trimmed}`;
	}
	return trimmed;
}

const CURRENT_YEAR = new Date().getFullYear();

// ============================================================================
// URL TYPE DETECTION
// ============================================================================

type UrlContentType = 'movie' | 'tv_show' | 'music' | 'video' | 'book' | 'image' | 'link';

function detectTypeFromUrl(urlStr: string): UrlContentType | null {
	try {
		const url = new URL(urlStr);
		const hostname = url.hostname.replace(/^www\./, '');
		const pathname = url.pathname;

		if (/\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/i.test(urlStr)) return 'image';
		if (/^(i\.)?imgur\.com/.test(hostname)) return 'image';

		if (hostname === 'youtube.com' && (pathname.startsWith('/watch') || pathname.startsWith('/shorts/'))) return 'video';
		if (hostname === 'youtu.be') return 'video';
		if (hostname === 'vimeo.com') return 'video';

		if (hostname === 'open.spotify.com' && /\/(track|album|artist|playlist)\//.test(pathname)) return 'music';
		if (hostname === 'music.apple.com') return 'music';
		if (hostname === 'music.youtube.com') return 'music';

		if (hostname === 'goodreads.com' && pathname.startsWith('/book/')) return 'book';
		if ((hostname === 'amazon.com.br' || hostname === 'amazon.com') && pathname.startsWith('/dp/')) return 'book';

		if (hostname === 'themoviedb.org' && pathname.startsWith('/tv/')) return 'tv_show';
		if (hostname === 'themoviedb.org' && pathname.startsWith('/movie/')) return 'movie';
		if (hostname === 'imdb.com' && pathname.startsWith('/title/')) return 'movie';
		if (hostname === 'letterboxd.com' && pathname.startsWith('/film/')) return 'movie';

		return null;
	} catch {
		return null;
	}
}

// ============================================================================
// TOOL FACTORY
// ============================================================================

/**
 * Constrói o mapa de tools para AI SDK com contexto do usuário injetado via closure.
 *
 * @param context - Contexto do usuário (userId, conversationId, provider)
 * @param enabledTools - Lista de nomes de tools habilitadas (CASL gate). Se omitido, todas disponíveis.
 */
export function buildTools(context: ToolContext, enabledTools?: string[]) {
	const allTools = buildAllTools(context);

	if (!enabledTools) return allTools;

	const filtered: Record<string, any> = {};
	for (const name of enabledTools) {
		if (name in allTools) {
			filtered[name] = (allTools as any)[name];
		}
	}
	return filtered as Partial<typeof allTools>;
}

function buildAllTools(context: ToolContext) {
	return {
		// ====================================================================
		// SAVE TOOLS - PURAS: SEMPRE salvam, nunca buscam
		// ====================================================================

		save_note: tool({
			description: 'Salva uma nota de texto na memória do usuário',
			parameters: z.object({
				content: z.string().describe('Conteúdo da nota'),
			}),
			execute: async ({ content }) => {
				const trimmed = content.trim();
				if (!trimmed) return { success: false, error: 'Conteúdo vazio' };
				const result = await itemService.createItem({
					userId: context.userId,
					type: 'note',
					title: trimmed.slice(0, 100),
					metadata: { content: trimmed, source: 'chat' } as unknown as NoteMetadata,
				});
				if (result.isDuplicate) {
					return { success: false, error: 'duplicate', message: 'Esta nota já foi salva.' };
				}
				return { success: true, data: { id: result.item?.id, title: result.item?.title } };
			},
		}),

		save_movie: tool({
			description: 'Salva um filme na memória. SEMPRE salva. Use enrich_movie antes para buscar metadata.',
			parameters: z.object({
				title: z.string().describe('Título do filme'),
				year: z.number().optional().describe('Ano de lançamento'),
				tmdb_id: z.number().optional().describe('ID no TMDB (obtido via enrich_movie)'),
				rating: z.number().optional().describe('Nota do filme (0-10)'),
				genres: z.array(z.string()).optional().describe('Gêneros'),
				overview: z.string().optional().describe('Sinopse'),
				poster_path: z.string().nullable().optional().describe('Caminho do poster TMDB'),
			}),
			execute: async ({ title, year, tmdb_id, rating, genres, overview, poster_path }) => {
				const normalizedTitle = title.trim();
				if (!normalizedTitle) return { success: false, error: 'Título vazio' };
				const safeYear = year ? clamp(year, 1888, CURRENT_YEAR + 5) : undefined;
				const safeRating = rating != null ? clamp(rating, 0, 10) : undefined;

				const metadata: MovieMetadata = {
					tmdb_id: tmdb_id || 0,
					year: safeYear || new Date().getFullYear(),
					genres: genres || [],
					rating: safeRating || 0,
					overview,
					poster_url: poster_path ?? undefined,
				} as MovieMetadata;

				if (tmdb_id) {
					void enrichmentService
						.enrich('movie', { tmdbId: tmdb_id })
						.catch((err) => loggers.ai.warn({ err, tmdb_id }, 'Enrichment async falhou'));
				}

				const result = await itemService.createItem({
					userId: context.userId, type: 'movie', title: normalizedTitle, metadata,
				});
				if (result.isDuplicate) {
					return { success: false, error: 'duplicate', message: 'Este filme já foi salvo.' };
				}
				return { success: true, data: { id: result.item?.id, title: normalizedTitle, tmdb_id } };
			},
		}),

		save_tv_show: tool({
			description: 'Salva uma série na memória. SEMPRE salva. Use enrich_tv_show antes para buscar metadata.',
			parameters: z.object({
				title: z.string().describe('Título da série'),
				year: z.number().optional().describe('Ano de estreia'),
				tmdb_id: z.number().optional().describe('ID no TMDB (obtido via enrich_tv_show)'),
				rating: z.number().optional().describe('Nota (0-10)'),
				genres: z.array(z.string()).optional().describe('Gêneros'),
				overview: z.string().optional().describe('Sinopse'),
				poster_path: z.string().nullable().optional().describe('Caminho do poster TMDB'),
			}),
			execute: async ({ title, year, tmdb_id, rating, genres, overview, poster_path }) => {
				const normalizedTitle = title.trim();
				if (!normalizedTitle) return { success: false, error: 'Título vazio' };
				const safeYear = year ? clamp(year, 1920, CURRENT_YEAR + 5) : undefined;
				const safeRating = rating != null ? clamp(rating, 0, 10) : undefined;

				const metadata: TVShowMetadata = {
					tmdb_id: tmdb_id || 0,
					first_air_date: safeYear || new Date().getFullYear(),
					number_of_seasons: 0,
					number_of_episodes: 0,
					status: 'Unknown',
					genres: genres || [],
					rating: safeRating || 0,
					overview,
					poster_url: poster_path ?? undefined,
				} as TVShowMetadata;

				if (tmdb_id) {
					void enrichmentService
						.enrich('tv_show', { tmdbId: tmdb_id })
						.catch((err) => loggers.ai.warn({ err, tmdb_id }, 'Enrichment async falhou'));
				}

				const result = await itemService.createItem({
					userId: context.userId, type: 'tv_show', title: normalizedTitle, metadata,
				});
				if (result.isDuplicate) {
					return { success: false, error: 'duplicate', message: 'Esta série já foi salva.' };
				}
				return { success: true, data: { id: result.item?.id, title: normalizedTitle, tmdb_id } };
			},
		}),

		save_video: tool({
			description: 'Salva um vídeo (YouTube etc.) na memória do usuário',
			parameters: z.object({
				url: z.string().describe('URL do vídeo'),
				title: z.string().optional().describe('Título do vídeo'),
			}),
			execute: async ({ url, title }) => {
				const normalizedUrl = normalizeUrl(url);
				if (!normalizedUrl) return { success: false, error: 'URL vazia' };
				const result = await itemService.createItem({
					userId: context.userId,
					type: 'video',
					title: title?.trim() || normalizedUrl,
					metadata: { video_id: normalizedUrl, platform: 'youtube', channel_name: '', duration: 0 } as VideoMetadata,
				});
				return { success: true, data: { id: result.item?.id, title: result.item?.title } };
			},
		}),

		save_link: tool({
			description: 'Salva um link/URL genérico na memória do usuário',
			parameters: z.object({
				url: z.string().describe('URL do link'),
				description: z.string().optional().describe('Descrição do link'),
			}),
			execute: async ({ url, description }) => {
				const normalizedUrl = normalizeUrl(url);
				if (!normalizedUrl) return { success: false, error: 'URL vazia' };
				const result = await itemService.createItem({
					userId: context.userId,
					type: 'link',
					title: description?.trim() || normalizedUrl,
					metadata: { url: normalizedUrl, og_description: description?.trim() } as LinkMetadata,
				});
				return { success: true, data: { id: result.item?.id, title: result.item?.title } };
			},
		}),

		save_book: tool({
			description: 'Salva um livro na memória. SEMPRE salva. Use search_book antes para buscar metadata.',
			parameters: z.object({
				title: z.string().describe('Título do livro'),
				author: z.string().optional().describe('Autor do livro'),
				year: z.number().optional().describe('Ano de publicação'),
				google_books_id: z.string().optional().describe('ID no Google Books (obtido via search_book)'),
				isbn: z.string().optional().describe('ISBN'),
				cover_url: z.string().optional().describe('URL da capa'),
				publisher: z.string().optional().describe('Editora'),
				page_count: z.number().optional().describe('Número de páginas'),
				genres: z.array(z.string()).optional().describe('Gêneros'),
				description: z.string().optional().describe('Descrição'),
			}),
			execute: async ({ title, author, year, google_books_id, isbn, cover_url, publisher, page_count, genres, description }) => {
				const normalizedTitle = title.trim();
				if (!normalizedTitle) return { success: false, error: 'Título vazio' };
				const safeYear = year ? clamp(year, 1400, CURRENT_YEAR + 2) : undefined;
				const safePageCount = page_count ? clamp(page_count, 1, 50000) : undefined;

				const metadata: BookMetadata = {
					title: normalizedTitle,
					authors: author ? [author.trim()] : [],
					year: safeYear,
					publisher,
					page_count: safePageCount,
					genres: genres ?? [],
					description,
					cover_url,
					isbn,
					google_books_id: google_books_id ?? '',
				} as BookMetadata;

				const result = await itemService.createItem({
					userId: context.userId, type: 'book', title: normalizedTitle, metadata,
				});
				if (result.isDuplicate) {
					return { success: false, error: 'duplicate', message: 'Este livro já foi salvo.' };
				}
				return { success: true, data: { id: result.item?.id, title: normalizedTitle } };
			},
		}),

		save_music: tool({
			description: 'Salva uma música na memória. SEMPRE salva. Use search_music antes para buscar metadata.',
			parameters: z.object({
				title: z.string().describe('Título da música'),
				artist: z.string().optional().describe('Artista'),
				spotify_id: z.string().optional().describe('ID no Spotify (obtido via search_music)'),
				album: z.string().optional().describe('Álbum'),
				album_cover_url: z.string().optional().describe('URL da capa do álbum'),
				year: z.number().optional().describe('Ano de lançamento'),
				duration_ms: z.number().optional().describe('Duração em milissegundos'),
				spotify_url: z.string().optional().describe('URL do Spotify'),
			}),
			execute: async ({ title, artist, spotify_id, album, album_cover_url, year, duration_ms, spotify_url }) => {
				const normalizedTitle = title.trim();
				if (!normalizedTitle) return { success: false, error: 'Título vazio' };
				const safeYear = year ? clamp(year, 1900, CURRENT_YEAR + 2) : undefined;

				const metadata: MusicMetadata = {
					title: normalizedTitle,
					artist: artist?.trim() ?? '',
					artists: artist ? [artist.trim()] : [],
					album: album ?? '',
					album_cover_url,
					year: safeYear,
					duration_ms: duration_ms ?? 0,
					genres: [],
					spotify_id: spotify_id ?? '',
					spotify_url: spotify_url ?? '',
				} as MusicMetadata;

				const result = await itemService.createItem({
					userId: context.userId, type: 'music', title: normalizedTitle, metadata,
				});
				if (result.isDuplicate) {
					return { success: false, error: 'duplicate', message: 'Esta música já foi salva.' };
				}
				return { success: true, data: { id: result.item?.id, title: normalizedTitle } };
			},
		}),

		save_image: tool({
			description: 'Salva uma imagem na memória do usuário. SEMPRE salva.',
			parameters: z.object({
				url: z.string().describe('URL da imagem'),
				description: z.string().optional().describe('Descrição da imagem'),
			}),
			execute: async ({ url, description }) => {
				const normalizedUrl = normalizeUrl(url);
				if (!normalizedUrl) return { success: false, error: 'URL vazia' };
				const result = await itemService.createItem({
					userId: context.userId,
					type: 'image',
					title: description?.trim() || normalizedUrl,
					metadata: { url: normalizedUrl, description: description?.trim() } as ImageMetadata,
				});
				return { success: true, data: { id: result.item?.id, title: result.item?.title } };
			},
		}),

		save_memo: tool({
			description: 'Salva uma memória avulsa (quote, ideia, pensamento). SEMPRE salva.',
			parameters: z.object({
				content: z.string().describe('Conteúdo do memo'),
				source: z.string().optional().describe('Fonte ou contexto'),
			}),
			execute: async ({ content, source }) => {
				const trimmed = content.trim();
				if (!trimmed) return { success: false, error: 'Conteúdo vazio' };
				const result = await itemService.createItem({
					userId: context.userId,
					type: 'memo',
					title: trimmed.slice(0, 100),
					metadata: { content: trimmed, source: source?.trim(), created_via: 'chat' } as MemoMetadata,
				});
				if (result.isDuplicate) {
					return { success: false, error: 'duplicate', message: 'Este memo já foi salvo.' };
				}
				return { success: true, data: { id: result.item?.id, title: result.item?.title } };
			},
		}),

		// ====================================================================
		// SEARCH TOOLS - PURAS: SEMPRE buscam, nunca salvam
		// ====================================================================

		search_items: tool({
			description: 'Busca itens salvos na memória do usuário por texto. SOMENTE itens já salvos.',
			parameters: z.object({
				query: z.string().optional().describe('Texto de busca'),
				limit: z.number().optional().describe('Número máximo de resultados (1-50)'),
			}),
			execute: async ({ query, limit }) => {
				const safeLimit = limit ? clamp(limit, 1, 50) : 10;
				const items = await itemService.getUserItems(context.userId, query?.trim(), undefined, safeLimit);
				return {
					success: true,
					data: {
						count: items.length,
						items: items.map((item: any) => ({
							id: item.id,
							type: item.type,
							title: item.title,
							created_at: item.createdAt,
						})),
					},
				};
			},
		}),

		memory_search: tool({
			description: 'Busca semântica na memória do usuário (vector + keyword). Mais poderosa que search_items.',
			parameters: z.object({
				query: z.string().describe('Texto de busca semântica'),
				maxResults: z.number().optional().describe('Máximo de resultados (1-50)'),
				types: z.array(z.string()).optional().describe('Filtrar por tipo: movie, tv_show, video, link, note, memo, book, music, image'),
			}),
			execute: async ({ query, maxResults, types }) => {
				const safeMax = maxResults ? clamp(maxResults, 1, 50) : 10;
				const { searchMemory } = await import('@/services/memory-search');
				const results = await searchMemory({
					query: query.trim(), userId: context.userId, maxResults: safeMax, types,
				});
				return {
					success: true,
					data: {
						results: results.map((r: any) => ({
							id: r.id, type: r.type, title: r.title, metadata: r.metadata, score: r.score,
						})),
						count: results.length,
					},
				};
			},
		}),

		memory_get: tool({
			description: 'Busca um item específico da memória por ID',
			parameters: z.object({
				id: z.string().describe('ID do item'),
			}),
			execute: async ({ id }) => {
				const { getMemoryItem } = await import('@/services/memory-search');
				const item = await getMemoryItem(id.trim(), context.userId);
				if (!item) return { success: false, error: 'Item não encontrado' };
				return { success: true, data: { id: item.id, type: item.type, title: item.title, metadata: item.metadata } };
			},
		}),

		daily_log_search: tool({
			description: 'Busca no diário do usuário por data ou conteúdo',
			parameters: z.object({
				date: z.string().optional().describe('Data no formato YYYY-MM-DD'),
				query: z.string().optional().describe('Texto de busca'),
			}),
			execute: async ({ date, query }) => {
				const { searchDailyLogs } = await import('@/services/memory-search');
				const logs = await searchDailyLogs({ userId: context.userId, date: date?.trim(), query: query?.trim() });
				return { success: true, data: { logs, count: logs.length } };
			},
		}),

		// ====================================================================
		// ENRICHMENT/SEARCH TOOLS - PURAS: SEMPRE buscam metadata, nunca salvam
		// ====================================================================

		enrich_movie: tool({
			description: 'Busca candidatos de filme no TMDB. Retorna lista de resultados. Use save_movie depois para salvar.',
			parameters: z.object({
				title: z.string().describe('Título do filme para buscar'),
				year: z.number().optional().describe('Ano de lançamento'),
			}),
			execute: async ({ title, year }) => {
				const safeYear = year ? clamp(year, 1888, CURRENT_YEAR + 5) : undefined;
				const results = await enrichmentService.searchMovies(title.trim(), safeYear);
				if (!results || results.length === 0) return { success: false, error: 'Nenhum filme encontrado' };
				return {
					success: true,
					data: {
						results: results.map((r: any) => ({
							type: 'movie' as const,
							title: r.title,
							year: r.release_date ? Number.parseInt(r.release_date.split('-')[0]) : null,
							tmdb_id: r.id,
							rating: r.vote_average || 0,
							overview: r.overview || '',
							poster_path: r.poster_path,
						})),
					},
				};
			},
		}),

		enrich_tv_show: tool({
			description: 'Busca candidatos de série no TMDB. Retorna lista de resultados. Use save_tv_show depois para salvar.',
			parameters: z.object({
				title: z.string().describe('Título da série para buscar'),
				year: z.number().optional().describe('Ano de estreia'),
			}),
			execute: async ({ title, year }) => {
				const safeYear = year ? clamp(year, 1920, CURRENT_YEAR + 5) : undefined;
				const results = await enrichmentService.searchTVShows(title.trim(), safeYear);
				if (!results || results.length === 0) return { success: false, error: 'Nenhuma série encontrada' };
				return {
					success: true,
					data: {
						results: results.map((r: any) => ({
							type: 'tv_show' as const,
							title: r.name,
							year: r.first_air_date,
							tmdb_id: r.id,
							rating: r.rating,
							overview: r.overview,
							poster_path: r.poster_path,
						})),
					},
				};
			},
		}),

		enrich_video: tool({
			description: 'Busca metadata de vídeo no YouTube a partir da URL',
			parameters: z.object({
				url: z.string().describe('URL do vídeo YouTube'),
			}),
			execute: async ({ url }) => {
				const normalizedUrl = normalizeUrl(url);
				const videoIdMatch = normalizedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
				if (!videoIdMatch) return { success: false, error: 'URL inválida do YouTube' };
				return { success: true, data: { video_id: videoIdMatch[1], url: normalizedUrl } };
			},
		}),

		search_book: tool({
			description: 'Busca candidatos de livro no Google Books. Retorna metadata. Use save_book depois para salvar.',
			parameters: z.object({
				title: z.string().describe('Título do livro'),
				author: z.string().optional().describe('Autor do livro'),
			}),
			execute: async ({ title, author }) => {
				const found = await bookService.searchBook(title.trim(), author?.trim());
				if (!found) return { success: false, error: 'Nenhum livro encontrado' };
				return {
					success: true,
					data: {
						results: [{
							type: 'book' as const,
							title: found.title,
							author: found.authors?.[0],
							year: found.year,
							cover_url: found.cover_url,
							description: found.description,
							google_books_id: found.google_books_id,
							isbn: found.isbn,
							publisher: found.publisher,
							page_count: found.page_count,
							genres: found.genres,
						}],
					},
				};
			},
		}),

		search_music: tool({
			description: 'Busca candidatos de música no Spotify. Retorna metadata. Use save_music depois para salvar.',
			parameters: z.object({
				title: z.string().describe('Título da música'),
				artist: z.string().optional().describe('Artista'),
			}),
			execute: async ({ title, artist }) => {
				const found = await spotifyService.searchTrack(title.trim(), artist?.trim());
				if (!found) return { success: false, error: 'Nenhuma música encontrada' };
				return {
					success: true,
					data: {
						results: [{
							type: 'music' as const,
							title: found.title,
							artist: found.artist,
							album: found.album,
							album_cover_url: found.album_cover_url,
							year: found.year,
							duration_ms: found.duration_ms,
							spotify_id: found.spotify_id,
							spotify_url: found.spotify_url,
						}],
					},
				};
			},
		}),

		// ====================================================================
		// DELETE TOOLS
		// ====================================================================

		delete_memory: tool({
			description: 'Deleta um item da memória por ID. Operação irreversível.',
			parameters: z.object({
				item_id: z.string().describe('ID do item a deletar'),
			}),
			execute: async ({ item_id }) => {
				await itemService.deleteItem(item_id.trim(), context.userId);
				return { success: true, message: 'Item deletado com sucesso' };
			},
		}),

		delete_all_memories: tool({
			description: 'Deleta TODOS os itens da memória. Pode filtrar por tipo. Operação irreversível.',
			parameters: z.object({
				type: z.string().optional().describe('Tipo para filtrar: movie, tv_show, video, link, note, memo, book, music, image. Se omitido, deleta tudo.'),
			}),
			execute: async ({ type }) => {
				const deleted_count = await itemService.deleteAllItems(context.userId, type?.trim());
				return { success: true, data: { deleted_count, type: type ?? null }, message: `${deleted_count} item(ns) deletado(s)` };
			},
		}),

		// ====================================================================
		// PREFERENCES TOOLS
		// ====================================================================

		update_user_settings: tool({
			description: 'Atualiza configurações do usuário (ex: nome do assistente)',
			parameters: z.object({
				assistantName: z.string().optional().describe('Novo nome para o assistente'),
			}),
			execute: async ({ assistantName }) => {
				const { preferencesService } = await import('@/services/preferences-service');
				if (assistantName !== undefined) {
					await preferencesService.setAssistantName(context.userId, assistantName?.trim() ?? '');
					return { success: true, message: assistantName ? `Nome atualizado para "${assistantName.trim()}"` : 'Nome resetado para "Nexo"' };
				}
				return { success: false, error: 'Nenhuma configuração fornecida' };
			},
		}),

		get_assistant_name: tool({
			description: 'Retorna o nome atual do assistente',
			parameters: z.object({}),
			execute: async () => {
				const { preferencesService } = await import('@/services/preferences-service');
				const name = await preferencesService.getAssistantName(context.userId);
				return { success: true, data: { name: name || 'Nexo' } };
			},
		}),

		// ====================================================================
		// INTEGRATION TOOLS - Calendar, Todo, Reminders
		// ====================================================================

		list_calendar_events: tool({
			description: 'Lista eventos do Google Calendar do usuário',
			parameters: z.object({
				startDate: z.string().optional().describe('Data/hora de início (ISO 8601 ou linguagem natural)'),
				endDate: z.string().optional().describe('Data/hora de fim (ISO 8601 ou linguagem natural)'),
				maxResults: z.number().optional().describe('Máximo de eventos (1-50)'),
			}),
			execute: async ({ startDate, endDate, maxResults }) => {
				const safeMax = maxResults ? clamp(maxResults, 1, 50) : 10;
				const { hasGoogleCalendarConnected, listCalendarEvents: listEvents } = await import('@/services/integrations/google-calendar.service');
				const isConnected = await hasGoogleCalendarConnected(context.userId);
				if (!isConnected) return { success: false, error: 'Conecte sua conta Google primeiro pelo dashboard.' };

				let start: Date | undefined;
				let end: Date | undefined;
				if (startDate) {
					const { parseNaturalDate } = await import('@/services/date-parser');
					start = await parseNaturalDate(startDate.trim());
				}
				if (endDate) {
					const { parseNaturalDate } = await import('@/services/date-parser');
					end = await parseNaturalDate(endDate.trim());
				}

				const events = await listEvents(context.userId, start, end, safeMax);
				return {
					success: true,
					data: {
						events: events.map((e: any) => ({
							id: e.id, title: e.title, description: e.description,
							start: e.start.toISOString(), end: e.end?.toISOString(), location: e.location,
						})),
						count: events.length,
					},
				};
			},
		}),

		create_calendar_event: tool({
			description: 'Cria evento no Google Calendar',
			parameters: z.object({
				title: z.string().describe('Título do evento'),
				startDate: z.string().describe('Data/hora de início (ISO 8601 ou linguagem natural)'),
				endDate: z.string().optional().describe('Data/hora de fim'),
				description: z.string().optional().describe('Descrição do evento'),
				duration: z.number().optional().describe('Duração em minutos (se endDate não fornecido)'),
				location: z.string().optional().describe('Local do evento'),
			}),
			execute: async ({ title, startDate, endDate, description, duration, location }) => {
				const safeDuration = duration ? clamp(duration, 1, 1440) : undefined;
				const { hasGoogleCalendarConnected, createCalendarEvent: createEvent } = await import('@/services/integrations/google-calendar.service');
				const isConnected = await hasGoogleCalendarConnected(context.userId);
				if (!isConnected) return { success: false, error: 'Conecte sua conta Google primeiro pelo dashboard.' };

				const { parseNaturalDate } = await import('@/services/date-parser');
				const start = await parseNaturalDate(startDate.trim());
				let end: Date | undefined;
				if (endDate) {
					end = await parseNaturalDate(endDate.trim());
				} else if (safeDuration) {
					end = new Date(start.getTime() + safeDuration * 60 * 1000);
				} else {
					end = new Date(start.getTime() + 60 * 60 * 1000);
				}

				const eventId = await createEvent(context.userId, {
					title: title.trim(), description: description?.trim(), startDate: start, endDate: end, location: location?.trim(),
				});
				return { success: true, message: `Evento "${title.trim()}" criado para ${start.toLocaleString('pt-BR')}`, data: { eventId } };
			},
		}),

		list_todos: tool({
			description: 'Lista tarefas do Microsoft To Do',
			parameters: z.object({}),
			execute: async () => {
				const { hasMicrosoftTodoConnected, listTasks } = await import('@/services/integrations/microsoft-todo.service');
				const isConnected = await hasMicrosoftTodoConnected(context.userId);
				if (!isConnected) return { success: false, error: 'Conecte sua conta Microsoft primeiro pelo dashboard.' };
				const tasks = await listTasks(context.userId);
				return {
					success: true,
					data: {
						tasks: tasks.map((t: any) => ({
							id: t.id, title: t.title, description: t.description,
							dueDateTime: t.dueDateTime?.toISOString(), isCompleted: t.isCompleted,
						})),
						count: tasks.length,
					},
				};
			},
		}),

		create_todo: tool({
			description: 'Cria tarefa no Microsoft To Do',
			parameters: z.object({
				title: z.string().describe('Título da tarefa'),
				description: z.string().optional().describe('Descrição da tarefa'),
				dueDate: z.string().optional().describe('Data de vencimento (ISO 8601 ou linguagem natural)'),
			}),
			execute: async ({ title, description, dueDate }) => {
				const { hasMicrosoftTodoConnected, createTask } = await import('@/services/integrations/microsoft-todo.service');
				const isConnected = await hasMicrosoftTodoConnected(context.userId);
				if (!isConnected) return { success: false, error: 'Conecte sua conta Microsoft primeiro pelo dashboard.' };

				let dueDateTime: Date | undefined;
				if (dueDate) {
					const { parseNaturalDate } = await import('@/services/date-parser');
					dueDateTime = await parseNaturalDate(dueDate.trim());
				}
				const taskId = await createTask(context.userId, { title: title.trim(), description: description?.trim(), dueDateTime });
				return { success: true, message: `Tarefa "${title.trim()}" criada`, data: { taskId } };
			},
		}),

		schedule_reminder: tool({
			description: 'Agenda um lembrete para ser enviado em data/hora específica',
			parameters: z.object({
				title: z.string().describe('Título do lembrete'),
				description: z.string().optional().describe('Descrição do lembrete'),
				when: z.string().describe('Quando enviar (ISO 8601 ou linguagem natural, ex: "amanhã às 9h")'),
			}),
			execute: async ({ title, description, when }) => {
				if (!context.provider || !context.externalId) {
					return { success: false, error: 'Não foi possível identificar o canal para enviar o lembrete' };
				}
				const { parseNaturalDate } = await import('@/services/date-parser');
				const scheduledFor = await parseNaturalDate(when.trim());
				const { scheduleReminder } = await import('@/services/scheduler-service');
				const reminderId = await scheduleReminder({
					userId: context.userId, title: title.trim(), description: description?.trim(),
					scheduledFor, provider: context.provider, externalId: context.externalId,
				});
				return { success: true, message: `Lembrete agendado para ${scheduledFor.toLocaleString('pt-BR')}`, data: { reminderId, scheduledFor: scheduledFor.toISOString() } };
			},
		}),

		// ====================================================================
		// CONTEXT TOOLS
		// ====================================================================

		resolve_context_reference: tool({
			description: 'Resolve referência contextual do usuário ("esse primeiro", "aquele filme"). Busca nas mensagens recentes.',
			parameters: z.object({
				reference_hint: z.string().describe('O texto de referência do usuário (ex: "esse", "o primeiro", "aquele filme")'),
			}),
			execute: async ({ reference_hint: _hint }) => {
				const history = await conversationService.getHistory(context.conversationId, 6);
				const assistantMessages = history.filter((m: any) => m.role === 'assistant').reverse();
				if (assistantMessages.length === 0) return { success: false, error: 'Nenhuma mensagem recente encontrada.' };

				const entityPatterns = [
					/['"]([^'"]{2,60})['"]/g,
					/(?:como|seria|parece|chama(?:do)?|título|chamado)\s+['"]?([A-Z][\w\s:–-]{1,50})['"]?/gi,
					/(?:^|\n)\d+[.)\s]+([A-Z][\w\s:–-]{1,50})/gm,
				];
				const candidates: Array<{ entity: string; source: string }> = [];
				for (const msg of assistantMessages) {
					for (const pattern of entityPatterns) {
						const re = new RegExp(pattern.source, pattern.flags);
						let match: RegExpExecArray | null;
						while ((match = re.exec(msg.content)) !== null) {
							const entity = match[1]?.trim();
							if (entity && entity.length >= 2) candidates.push({ entity, source: msg.content.slice(0, 120) });
						}
					}
					if (candidates.length > 0) break;
				}
				if (candidates.length === 0) return { success: false, error: 'Não consegui identificar o item referenciado.' };
				const best = candidates[0];
				return { success: true, data: { resolved: best.entity, confidence: candidates.length === 1 ? 0.9 : 0.7, source_message: best.source } };
			},
		}),

		// ====================================================================
		// WEB TOOLS
		// ====================================================================

		web_search: tool({
			description: 'Pesquisa na web via Brave Search. Retorna resultados estruturados.',
			parameters: z.object({
				query: z.string().describe('Texto de busca'),
				count: z.number().optional().describe('Número de resultados (1-20)'),
			}),
			execute: async ({ query, count }) => {
				const safeCount = count ? clamp(count, 1, 20) : 5;
				const trimmed = query.trim();
				if (!trimmed) return { success: false, error: 'Query vazia' };
				const results = await braveSearchService.search(trimmed, safeCount);
				if (results.length === 0) return { success: false, error: 'Nenhum resultado encontrado' };
				return { success: true, data: { type: 'web_search' as const, query: trimmed, results } };
			},
		}),

		analyze_url: tool({
			description: 'Analisa uma URL e detecta tipo de conteúdo (filme, série, vídeo, música, livro, link). Use quando receber uma URL sem contexto.',
			parameters: z.object({
				url: z.string().describe('URL para analisar'),
			}),
			execute: async ({ url }) => {
				const normalizedUrl = normalizeUrl(url);
				if (!normalizedUrl) return { success: false, error: 'URL vazia' };

				const detectedByPattern = detectTypeFromUrl(normalizedUrl);
				const ogMetadata = await openGraphService.fetchMetadata(normalizedUrl);
				const detected_type: UrlContentType = detectedByPattern ?? 'link';
				const TYPE_CATEGORY: Record<UrlContentType, string> = {
					movie: 'enrichable', tv_show: 'enrichable', music: 'enrichable',
					video: 'enrichable', book: 'enrichable', image: 'text', link: 'text',
				};
				return {
					success: true,
					data: {
						detected_type,
						type_category: TYPE_CATEGORY[detected_type],
						title: ogMetadata.og_title,
						metadata: {
							url: normalizedUrl,
							og_title: ogMetadata.og_title,
							og_description: ogMetadata.og_description,
							og_image: ogMetadata.og_image,
							domain: ogMetadata.domain,
						},
					},
				};
			},
		}),
	};
}

/** Tipo inferido do mapa de tools */
export type NexoTools = ReturnType<typeof buildAllTools>;
export type NexoToolName = keyof NexoTools;
