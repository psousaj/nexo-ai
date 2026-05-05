/**
 * AI SDK Tool Definitions - Thin Wrappers
 *
 * This file provides AI SDK `tool()` definitions with Zod schemas that delegate
 * all execution logic to the standalone functions in `./index.ts`.
 *
 * Pattern:
 *   1. Implement logic in `./index.ts` (single source of truth)
 *   2. Define Zod input schema here
 *   3. Wrap with `tool()` calling the index.ts function
 *
 * To create a new tool:
 *   1. Implement in `./index.ts`
 *   2. Register in `AVAILABLE_TOOLS` and `ToolName` type
 *   3. Add metadata in `./registry.ts`
 *   4. Add schema + wrapper here
 */

import { tool } from 'ai';
import { z } from 'zod';
import {
	type ToolContext,
	analyze_url,
	create_calendar_event,
	create_todo,
	daily_log_search,
	delete_all_memories,
	delete_memory,
	enrich_movie,
	enrich_tv_show,
	enrich_video,
	get_assistant_name,
	list_calendar_events,
	list_todos,
	memory_get,
	memory_search,
	resolve_context_reference,
	save_book,
	save_image,
	save_link,
	save_memory,
	save_movie,
	save_music,
	save_note,
	save_tv_show,
	save_video,
	schedule_reminder,
	search_book,
	search_items,
	search_music,
	update_user_settings,
	web_search,
} from './index';

// Re-export ToolContext for consumers
export type { ToolContext } from './index';

const CURRENT_YEAR = new Date().getFullYear();

function clamp(val: number, min: number, max: number): number {
	return Math.min(Math.max(val, min), max);
}

// ============================================================================
// TOOL FACTORY
// ============================================================================

/**
 * Builds the AI SDK tool map with user context injected via closure.
 * Each tool delegates execution to the standalone functions in ./index.ts.
 *
 * @param context - User context (userId, conversationId, provider)
 * @param enabledTools - List of enabled tool names (CASL gate). If omitted, all available.
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
		// SAVE TOOLS
		// ====================================================================

		save_note: tool({
			description: 'Salva uma nota de texto na memória do usuário',
			inputSchema: z.object({
				content: z.string().describe('Conteúdo da nota'),
			}),
			execute: async ({ content }) => save_note(context, { content }),
		}),

		save_movie: tool({
			description: 'Salva um filme na memória. SEMPRE salva. Use enrich_movie antes para buscar metadata.',
			inputSchema: z.object({
				title: z.string().describe('Título do filme'),
				year: z.number().optional().describe('Ano de lançamento'),
				tmdb_id: z.number().optional().describe('ID no TMDB (obtido via enrich_movie)'),
				rating: z.number().optional().describe('Nota do filme (0-10)'),
				genres: z.array(z.string()).optional().describe('Gêneros'),
				overview: z.string().optional().describe('Sinopse'),
				poster_path: z.string().nullable().optional().describe('Caminho do poster TMDB'),
			}),
			execute: async ({ title, year, tmdb_id, rating, genres, overview, poster_path }) =>
				save_movie(context, { title, year, tmdb_id, rating, genres, overview, poster_path }),
		}),

		save_tv_show: tool({
			description: 'Salva uma série na memória. SEMPRE salva. Use enrich_tv_show antes para buscar metadata.',
			inputSchema: z.object({
				title: z.string().describe('Título da série'),
				year: z.number().optional().describe('Ano de estreia'),
				tmdb_id: z.number().optional().describe('ID no TMDB'),
				rating: z.number().optional().describe('Nota (0-10)'),
				genres: z.array(z.string()).optional().describe('Gêneros'),
				overview: z.string().optional().describe('Sinopse'),
				poster_path: z.string().nullable().optional().describe('Caminho do poster TMDB'),
			}),
			execute: async ({ title, year, tmdb_id, rating, genres, overview, poster_path }) =>
				save_tv_show(context, { title, year, tmdb_id, rating, genres, overview, poster_path }),
		}),

		save_video: tool({
			description: 'Salva um vídeo do YouTube na memória',
			inputSchema: z.object({
				url: z.string().describe('URL do vídeo no YouTube'),
				title: z.string().optional().describe('Título do vídeo (opcional)'),
			}),
			execute: async ({ url, title }) => save_video(context, { url, title }),
		}),

		save_link: tool({
			description: 'Salva um link genérico na memória',
			inputSchema: z.object({
				url: z.string().describe('URL do link'),
				title: z.string().optional().describe('Título descritivo'),
				description: z.string().optional().describe('Descrição do link'),
			}),
			execute: async ({ url, title, description }) => save_link(context, { url, description: description ?? title }),
		}),

		save_book: tool({
			description: 'Salva um livro na memória. Use search_book antes para buscar metadata.',
			inputSchema: z.object({
				title: z.string().describe('Título do livro'),
				author: z.string().optional().describe('Autor'),
				year: z.number().optional().describe('Ano de publicação'),
				isbn: z.string().optional().describe('ISBN'),
				genres: z.array(z.string()).optional().describe('Gêneros'),
				description: z.string().optional().describe('Descrição'),
				page_count: z.number().optional().describe('Número de páginas'),
				cover_url: z.string().optional().describe('URL da capa'),
				google_books_id: z.string().optional().describe('ID no Google Books'),
			}),
			execute: async (params) => save_book(context, params),
		}),

		save_music: tool({
			description: 'Salva uma música na memória. Use search_music antes para buscar metadata.',
			inputSchema: z.object({
				title: z.string().describe('Título da música'),
				artist: z.string().optional().describe('Artista'),
				album: z.string().optional().describe('Álbum'),
				year: z.number().optional().describe('Ano'),
				spotify_id: z.string().optional().describe('ID no Spotify'),
				spotify_url: z.string().optional().describe('URL no Spotify'),
				duration_ms: z.number().optional().describe('Duração em ms'),
			}),
			execute: async (params) => save_music(context, params),
		}),

		save_image: tool({
			description: 'Salva uma imagem na memória com metadados.',
			inputSchema: z.object({
				url: z.string().describe('URL da imagem'),
				title: z.string().optional().describe('Título'),
				description: z.string().optional().describe('Descrição'),
				source: z.string().optional().describe('Fonte da imagem'),
			}),
			execute: async (params) => save_image(context, params),
		}),

		save_memory: tool({
			description: 'Salva uma memória genérica',
			inputSchema: z.object({
				title: z.string().describe('Título da memória'),
				content: z.string().describe('Conteúdo da memória'),
				type: z
					.enum(['note', 'link', 'movie', 'book', 'music', 'video', 'image', 'tv_show'])
					.optional()
					.describe('Tipo da memória'),
			}),
			execute: async (params) => save_memory(context, params),
		}),

		// ====================================================================
		// SEARCH TOOLS
		// ====================================================================

		search_items: tool({
			description: 'Busca itens salvos na memória do usuário por título.',
			inputSchema: z.object({
				query: z.string().describe('Termo de busca'),
				limit: z.number().optional().describe('Máximo de resultados (1-20)'),
			}),
			execute: async ({ query, limit }) => search_items(context, { query, limit }),
		}),

		search_book: tool({
			description: 'Busca candidatos de livro no Google Books. Retorna metadata. Use save_book depois para salvar.',
			inputSchema: z.object({
				title: z.string().describe('Título do livro'),
				author: z.string().optional().describe('Autor do livro'),
			}),
			execute: async ({ title, author }) => search_book(context, { title, author }),
		}),

		search_music: tool({
			description: 'Busca candidatos de música no Spotify. Retorna metadata. Use save_music depois para salvar.',
			inputSchema: z.object({
				title: z.string().describe('Título da música'),
				artist: z.string().optional().describe('Artista'),
			}),
			execute: async ({ title, artist }) => search_music(context, { title, artist }),
		}),

		// ====================================================================
		// ENRICHMENT TOOLS
		// ====================================================================

		enrich_movie: tool({
			description: 'Busca metadata de filme no TMDB. Retorna candidatos para o usuário escolher.',
			inputSchema: z.object({
				title: z.string().describe('Título do filme'),
				year: z.number().optional().describe('Ano de lançamento'),
			}),
			execute: async ({ title, year }) => enrich_movie(context, { title, year }),
		}),

		enrich_tv_show: tool({
			description: 'Busca metadata de série de TV no TMDB.',
			inputSchema: z.object({
				title: z.string().describe('Título da série'),
				year: z.number().optional().describe('Ano de estreia'),
			}),
			execute: async ({ title, year }) => enrich_tv_show(context, { title, year }),
		}),

		enrich_video: tool({
			description: 'Busca metadata de vídeo do YouTube.',
			inputSchema: z.object({
				url: z.string().describe('URL do vídeo no YouTube'),
			}),
			execute: async ({ url }) => enrich_video(context, { url }),
		}),

		// ====================================================================
		// MEMORY TOOLS
		// ====================================================================

		memory_search: tool({
			description: 'Busca semântica na memória do usuário',
			inputSchema: z.object({
				query: z.string().describe('Query de busca semântica'),
				maxResults: z.number().optional().describe('Máximo de resultados'),
				types: z.array(z.string()).optional().describe('Filtrar por tipos'),
			}),
			execute: async ({ query, maxResults, types }) => memory_search(context, { query, maxResults, types }),
		}),

		memory_get: tool({
			description: 'Recupera um item da memória por ID',
			inputSchema: z.object({
				item_id: z.string().describe('ID do item'),
			}),
			execute: async ({ item_id }) => memory_get(context, { id: item_id }),
		}),

		daily_log_search: tool({
			description: 'Busca no log diário de atividades do assistente',
			inputSchema: z.object({
				query: z.string().describe('Query de busca'),
				date: z.string().optional().describe('Data (YYYY-MM-DD)'),
			}),
			execute: async (params) => daily_log_search(context, { query: params.query, date: params.date }),
		}),

		// ====================================================================
		// DELETE TOOLS
		// ====================================================================

		delete_memory: tool({
			description: 'Deleta um item da memória por ID. Operação irreversível.',
			inputSchema: z.object({
				item_id: z.string().describe('ID do item a deletar'),
			}),
			execute: async ({ item_id }) => delete_memory(context, { item_id }),
		}),

		delete_all_memories: tool({
			description: 'Deleta todos os itens da memória do usuário. Use com cautela.',
			inputSchema: z.object({
				type: z.string().optional().describe('Filtrar por tipo (movie, book, etc)'),
			}),
			execute: async ({ type }) => delete_all_memories(context, { type }),
		}),

		// ====================================================================
		// PREFERENCES TOOLS
		// ====================================================================

		update_user_settings: tool({
			description: 'Atualiza preferências do assistente para o usuário',
			inputSchema: z.object({
				assistant_name: z.string().optional().describe('Nome do assistente'),
				assistant_tone: z.string().optional().describe('Tom de resposta'),
				assistant_creature: z.string().optional().describe('Criatura do assistente'),
				assistant_emoji: z.string().optional().describe('Emoji do assistente'),
			}),
			execute: async (params) => update_user_settings(context, { assistantName: params.assistant_name }),
		}),

		get_assistant_name: tool({
			description: 'Obtém o nome e configurações do assistente',
			inputSchema: z.object({}),
			execute: async () => get_assistant_name(context, {}),
		}),

		// ====================================================================
		// INTEGRATION TOOLS
		// ====================================================================

		list_calendar_events: tool({
			description: 'Lista eventos do calendário do usuário',
			inputSchema: z.object({
				startDate: z.string().optional().describe('Data inicial (ISO ou natural)'),
				endDate: z.string().optional().describe('Data final (ISO ou natural)'),
				maxResults: z.number().optional().describe('Máximo de eventos'),
			}),
			execute: async (params) => list_calendar_events(context, params),
		}),

		create_calendar_event: tool({
			description: 'Cria um evento no calendário do usuário',
			inputSchema: z.object({
				title: z.string().describe('Título do evento'),
				startDate: z.string().describe('Data/hora de início (ISO ou natural)'),
				endDate: z.string().optional().describe('Data/hora de fim (ISO ou natural)'),
				description: z.string().optional().describe('Descrição do evento'),
				location: z.string().optional().describe('Local do evento'),
			}),
			execute: async (params) => create_calendar_event(context, params),
		}),

		list_todos: tool({
			description: 'Lista tarefas do usuário',
			inputSchema: z.object({
				completed: z.boolean().optional().describe('Filtrar por status de conclusão'),
			}),
			execute: async ({ completed }) => list_todos(context, { completed: completed ?? false }),
		}),

		create_todo: tool({
			description: 'Cria uma nova tarefa',
			inputSchema: z.object({
				title: z.string().describe('Título da tarefa'),
				description: z.string().optional().describe('Descrição da tarefa'),
				due_date: z.string().optional().describe('Data de vencimento (YYYY-MM-DD)'),
				priority: z.enum(['low', 'medium', 'high']).optional().describe('Prioridade'),
			}),
			execute: async (params) => create_todo(context, params),
		}),

		schedule_reminder: tool({
			description: 'Agenda um lembrete para o usuário',
			inputSchema: z.object({
				title: z.string().describe('Título do lembrete'),
				when: z.string().describe('Quando lembrar (data/hora natural)'),
				description: z.string().optional().describe('Descrição do lembrete'),
			}),
			execute: async (params) => schedule_reminder(context, params),
		}),

		// ====================================================================
		// CONTEXT RESOLUTION
		// ====================================================================

		resolve_context_reference: tool({
			description: 'Resolve referências ambíguas como "ele", "isso", "aquele filme"',
			inputSchema: z.object({
				reference_hint: z.string().describe('Referência ambígua a resolver'),
			}),
			execute: async ({ reference_hint }) => resolve_context_reference(context, { reference_hint }),
		}),

		// ====================================================================
		// WEB TOOLS
		// ====================================================================

		web_search: tool({
			description: 'Busca na web usando Brave Search',
			inputSchema: z.object({
				query: z.string().describe('Query de busca'),
				count: z.number().optional().describe('Número de resultados'),
			}),
			execute: async ({ query, count }) => web_search(context, { query, count }),
		}),

		analyze_url: tool({
			description: 'Analisa uma URL e extrai metadados (título, descrição, imagem)',
			inputSchema: z.object({
				url: z.string().describe('URL para analisar'),
			}),
			execute: async ({ url }) => analyze_url(context, { url }),
		}),
	};
}
