/**
 * Tools com contratos fortes - v2
 *
 * Cada tool faz UMA coisa específica.
 * Entradas validadas, saídas previsíveis, zero decisão.
 */

import { conversationService } from '@/services/conversation-service';
import { getRandomLogMessage, toolLogs } from '@/services/conversation/logMessages';
import { enrichmentService } from '@/services/enrichment';
import { itemService } from '@/services/item-service';
import type { LinkMetadata, MovieMetadata, NoteMetadata, TVShowMetadata, VideoMetadata } from '@/types';
import { loggers } from '@/utils/logger';
import { setAttributes, startSpan } from '@nexo/otel/tracing';

export interface ToolContext {
	userId: string;
	conversationId: string;
	provider?: 'telegram' | 'whatsapp' | 'discord';
	externalId?: string;
}

export interface ToolOutput {
	success: boolean;
	message?: string;
	data?: any;
	error?: string;
}

// ============================================================================
// SAVE TOOLS - Contratos específicos por tipo
// ============================================================================

/**
 * Tool: save_note
 * Salva nota de texto
 */
export async function save_note(
	context: ToolContext,
	params: {
		content: string;
	},
): Promise<ToolOutput> {
	loggers.tools.info(`🔧 ${getRandomLogMessage(toolLogs.executing, { tool: 'save_note' })}`);
	loggers.tools.info(
		`📦 ${getRandomLogMessage(toolLogs.params, {
			params: JSON.stringify({ content: `${params.content?.substring(0, 100)}...` }),
		})}`,
	);

	if (!params.content?.trim()) {
		loggers.tools.error(
			`❌ ${getRandomLogMessage(toolLogs.error, {
				tool: 'save_note',
				error: 'Conteúdo vazio',
			})}`,
		);
		return { success: false, error: 'Conteúdo vazio' };
	}

	try {
		const result = await itemService.createItem({
			userId: context.userId,
			type: 'note',
			title: params.content.slice(0, 100),
			metadata: {
				full_content: params.content,
				created_via: 'chat',
			} as NoteMetadata,
		});

		// Verificar se é duplicata
		if (result.isDuplicate && result.existingItem) {
			loggers.tools.warn('⚠️ Nota duplicada detectada');
			return {
				success: false,
				error: 'duplicate',
				message: `⚠️ Esta nota já foi salva em ${new Date(result.existingItem.createdAt).toLocaleDateString('pt-BR')}.`,
			};
		}

		// Verificar se item foi criado com sucesso
		if (!result.item) {
			loggers.tools.error(
				`❌ ${getRandomLogMessage(toolLogs.error, {
					tool: 'save_note',
					error: 'itemService.createItem retornou null sem ser duplicata',
				})}`,
			);
			loggers.tools.error({ result }, '❌ Erro ao criar nota no banco de dados');
			return {
				success: false,
				error: 'Erro ao criar nota no banco de dados',
			};
		}

		loggers.tools.info(`✅ ${getRandomLogMessage(toolLogs.success, { tool: 'save_note' })}`);
		loggers.tools.info({ id: result.item.id }, '📝 Nota salva');

		return {
			success: true,
			data: { id: result.item.id, title: result.item.title },
		};
	} catch (error) {
		loggers.tools.error(
			{ err: error },
			`❌ ${getRandomLogMessage(toolLogs.error, {
				tool: 'save_note',
				error: error instanceof Error ? error.message : 'Erro desconhecido',
			})}`,
		);

		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao salvar nota',
		};
	}
}

/**
 * Tool: save_movie
 * Salva filme (com ou sem enriquecimento)
 * Se não tem tmdb_id, busca no TMDB e retorna candidatos para seleção
 * Se tem tmdb_id, salva imediatamente com dados básicos e dispara enriquecimento completo async
 */
export async function save_movie(
	context: ToolContext,
	params: {
		title: string;
		year?: number;
		tmdb_id?: number;
		rating?: number;
		genres?: string[];
		// Campos opcionais vindos do selectedItem (evita chamada síncrona ao TMDB)
		overview?: string;
		poster_path?: string | null;
	},
): Promise<ToolOutput> {
	if (!params.title?.trim()) {
		return { success: false, error: 'Título vazio' };
	}

	try {
		// Sem tmdb_id: busca no TMDB e retorna candidatos para o usuário escolher
		if (!params.tmdb_id) {
			loggers.tools.info(
				{ title: params.title, year: params.year },
				'🔍 save_movie sem tmdb_id → buscando candidatos no TMDB',
			);
			const results = await enrichmentService.searchMovies(params.title, params.year);

			if (results && results.length > 0) {
				return {
					success: true,
					data: {
						results: results.map((r) => ({
							type: 'movie' as const,
							title: r.title,
							year: r.release_date ? Number.parseInt(r.release_date.split('-')[0]) : undefined,
							tmdb_id: r.id,
							rating: r.vote_average || 0,
							overview: r.overview || '',
							poster_path: r.poster_path,
						})),
					},
				};
			}

			// Nenhum resultado no TMDB: salva sem enriquecimento como fallback
			loggers.tools.warn({ title: params.title }, '⚠️ TMDB sem resultados, salvando filme sem enriquecimento');
		}

		// Com tmdb_id: salva imediatamente com dados básicos disponíveis em params
		// e dispara enriquecimento completo em background (sem bloquear a resposta)
		const metadata: MovieMetadata = {
			tmdb_id: params.tmdb_id || 0,
			year: params.year || new Date().getFullYear(),
			genres: params.genres || [],
			rating: params.rating || 0,
			...(params.overview && { overview: params.overview }),
			...(params.poster_path && { poster_path: params.poster_path }),
		} as MovieMetadata;

		if (params.tmdb_id) {
			// Enriquecimento async — não bloqueia a resposta ao usuário
			void enrichmentService
				.enrich('movie', { tmdbId: params.tmdb_id })
				.catch((err) =>
					loggers.tools.warn({ err, tmdb_id: params.tmdb_id }, '⚠️ Enrichment async falhou (não crítico)'),
				);
		}

		const item = await itemService.createItem({
			userId: context.userId,
			type: 'movie',
			title: params.title,
			metadata,
		});

		return {
			success: true,
			data: { id: item.item.id, title: item.item.title },
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao salvar filme',
		};
	}
}

/**
 * Tool: save_tv_show
 * Salva série
 * Se não tem tmdb_id, busca no TMDB e retorna candidatos para seleção
 * Se tem tmdb_id, salva imediatamente com dados básicos e dispara enriquecimento completo async
 */
export async function save_tv_show(
	context: ToolContext,
	params: {
		title: string;
		year?: number;
		tmdb_id?: number;
		rating?: number;
		genres?: string[];
		// Campos opcionais vindos do selectedItem (evita chamada síncrona ao TMDB)
		overview?: string;
		poster_path?: string | null;
	},
): Promise<ToolOutput> {
	if (!params.title?.trim()) {
		return { success: false, error: 'Título vazio' };
	}

	try {
		// Sem tmdb_id: busca no TMDB e retorna candidatos para o usuário escolher
		if (!params.tmdb_id) {
			loggers.tools.info({ title: params.title }, '🔍 save_tv_show sem tmdb_id → buscando candidatos no TMDB');
			const results = await enrichmentService.searchTVShows(params.title);

			if (results && results.length > 0) {
				return {
					success: true,
					data: {
						results: results.map((r) => ({
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
			}

			// Nenhum resultado no TMDB: salva sem enriquecimento como fallback
			loggers.tools.warn({ title: params.title }, '⚠️ TMDB sem resultados, salvando série sem enriquecimento');
		}

		// Com tmdb_id: salva imediatamente com dados básicos disponíveis em params
		// e dispara enriquecimento completo em background (sem bloquear a resposta)
		const metadata: TVShowMetadata = {
			tmdb_id: params.tmdb_id || 0,
			first_air_date: params.year || new Date().getFullYear(),
			number_of_seasons: 0,
			number_of_episodes: 0,
			status: 'Unknown',
			genres: params.genres || [],
			rating: params.rating || 0,
			...(params.overview && { overview: params.overview }),
			...(params.poster_path && { poster_path: params.poster_path }),
		} as TVShowMetadata;

		if (params.tmdb_id) {
			// Enriquecimento async — não bloqueia a resposta ao usuário
			void enrichmentService
				.enrich('tv_show', { tmdbId: params.tmdb_id })
				.catch((err) =>
					loggers.tools.warn({ err, tmdb_id: params.tmdb_id }, '⚠️ Enrichment async falhou (não crítico)'),
				);
		}

		const item = await itemService.createItem({
			userId: context.userId,
			type: 'tv_show',
			title: params.title,
			metadata,
		});

		return {
			success: true,
			data: { id: item.item.id, title: item.item.title },
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao salvar série',
		};
	}
}

/**
 * Tool: save_video
 * Salva vídeo (YouTube etc)
 */
export async function save_video(
	context: ToolContext,
	params: {
		url: string;
		title?: string;
	},
): Promise<ToolOutput> {
	if (!params.url?.trim()) {
		return { success: false, error: 'URL vazia' };
	}

	try {
		const item = await itemService.createItem({
			userId: context.userId,
			type: 'video',
			title: params.title || params.url,
			metadata: {
				video_id: params.url,
				platform: 'youtube',
				channel_name: '',
				duration: 0,
			} as VideoMetadata,
		});

		return {
			success: true,
			data: { id: item.item.id, title: item.item.title },
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao salvar vídeo',
		};
	}
}

/**
 * Tool: save_link
 * Salva link genérico
 */
export async function save_link(
	context: ToolContext,
	params: {
		url: string;
		description?: string;
	},
): Promise<ToolOutput> {
	if (!params.url?.trim()) {
		return { success: false, error: 'URL vazia' };
	}

	try {
		const item = await itemService.createItem({
			userId: context.userId,
			type: 'link',
			title: params.description || params.url,
			metadata: {
				url: params.url,
				og_description: params.description,
			} as LinkMetadata,
		});

		return {
			success: true,
			data: { id: item.item.id, title: item.item.title },
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao salvar link',
		};
	}
}

// ============================================================================
// CONTEXT TOOLS
// ============================================================================

/**
 * Tool: collect_context
 * Gera opções de clarificação para mensagens ambíguas
 */
export async function collectContextTool(input: {
	message: string;
	detectedType: string | null;
}): Promise<{ clarificationOptions: string[] }> {
	if (!input.detectedType || input.detectedType === 'note') {
		// Se não detectou nada ou é apenas uma nota (genérico), oferece opções
		return {
			clarificationOptions: ['Salvar como nota', 'Salvar como filme', 'Salvar como série', 'Outro (especifique)'],
		};
	}
	return { clarificationOptions: [] };
}

// ============================================================================
// SEARCH TOOLS
// ============================================================================

/**
 * Tool: search_items
 * Busca itens salvos (genérico)
 */
export async function search_items(
	context: ToolContext,
	params: {
		query?: string;
		limit?: number;
	},
): Promise<ToolOutput> {
	try {
		const items = await itemService.getUserItems(context.userId, params.query, undefined, params.limit || 10);

		return {
			success: true,
			data: {
				count: items.length,
				items: items.map((item) => ({
					id: item.id,
					type: item.type,
					title: item.title,
					created_at: item.createdAt,
				})),
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao buscar',
		};
	}
}

// ============================================================================
// ENRICHMENT TOOLS - Busca metadata de APIs externas
// ============================================================================

/**
 * Tool: enrich_movie
 * Busca metadata de filme no TMDB
 */
export async function enrich_movie(
	_context: ToolContext,
	params: {
		title: string;
		year?: number;
	},
): Promise<ToolOutput> {
	if (!params.title?.trim()) {
		return { success: false, error: 'Título vazio' };
	}

	try {
		const results = await enrichmentService.searchMovies(params.title, params.year);

		if (!results || results.length === 0) {
			return {
				success: false,
				error: 'Nenhum filme encontrado',
			};
		}

		return {
			success: true,
			data: {
				results: results.map((r) => ({
					type: 'movie' as const,
					title: r.title,
					year: r.release_date ? Number.parseInt(r.release_date.split('-')[0]) : undefined,
					tmdb_id: r.id,
					rating: r.vote_average || 0,
					overview: r.overview || '',
					poster_path: r.poster_path,
				})),
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao buscar filme',
		};
	}
}

/**
 * Tool: enrich_tv_show
 * Busca metadata de série no TMDB
 */
export async function enrich_tv_show(
	_context: ToolContext,
	params: {
		title: string;
		year?: number;
	},
): Promise<ToolOutput> {
	if (!params.title?.trim()) {
		return { success: false, error: 'Título vazio' };
	}

	try {
		const results = await enrichmentService.searchTVShows(params.title, params.year);

		if (!results || results.length === 0) {
			return {
				success: false,
				error: 'Nenhuma série encontrada',
			};
		}

		return {
			success: true,
			data: {
				results: results.map((r) => ({
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
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao buscar série',
		};
	}
}

/**
 * Tool: enrich_video
 * Busca metadata de vídeo no YouTube
 */
export async function enrich_video(
	_context: ToolContext,
	params: {
		url: string;
	},
): Promise<ToolOutput> {
	if (!params.url?.trim()) {
		return { success: false, error: 'URL vazia' };
	}

	try {
		// Extrair video_id do URL
		const videoIdMatch = params.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
		if (!videoIdMatch) {
			return {
				success: false,
				error: 'URL inválida do YouTube',
			};
		}

		const videoId = videoIdMatch[1];
		// TODO: Implementar getYouTubeMetadata em enrichment service
		// const metadata = await enrichmentService.getYouTubeMetadata(videoId);

		return {
			success: true,
			message: 'Vídeo encontrado',
			data: {
				video_id: videoId,
				url: params.url,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao buscar vídeo',
		};
	}
}

// ============================================================================
// DELETE TOOLS (mantidas do sistema determinístico)
// ============================================================================

export async function delete_memory(
	context: ToolContext,
	params: {
		item_id: string;
	},
): Promise<ToolOutput> {
	try {
		if (!params.item_id) {
			return {
				success: false,
				error: 'item_id é obrigatório',
			};
		}

		await itemService.deleteItem(params.item_id, context.userId);

		return {
			success: true,
			message: 'Item deletado com sucesso',
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao deletar',
		};
	}
}

export async function delete_all_memories(context: ToolContext, params: { type?: string }): Promise<ToolOutput> {
	try {
		const deleted_count = await itemService.deleteAllItems(context.userId, params.type);

		const typeLabel: Record<string, string> = {
			note: 'nota(s)',
			movie: 'filme(s)',
			tv_show: 'série(s)',
			video: 'vídeo(s)',
			link: 'link(s)',
		};
		const label = params.type ? (typeLabel[params.type] ?? 'item(ns)') : 'item(ns)';

		return {
			success: true,
			data: { deleted_count, type: params.type ?? null },
			message: `${deleted_count} ${label} deletado(s)`,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao deletar tudo',
		};
	}
}

// ============================================================================
// UPDATE TOOLS
// ============================================================================

/**
 * Tool: update_user_settings
 * Atualiza configurações do usuário (nome do assistente, etc)
 */
export async function update_user_settings(
	context: ToolContext,
	params: {
		assistantName?: string;
	},
): Promise<ToolOutput> {
	try {
		const { preferencesService } = await import('@/services/preferences-service');

		if (params.assistantName !== undefined) {
			await preferencesService.setAssistantName(context.userId, params.assistantName);

			return {
				success: true,
				message: params.assistantName ? `Nome atualizado para "${params.assistantName}"` : 'Nome resetado para "Nexo"',
			};
		}

		return { success: false, error: 'Nenhuma configuração fornecida' };
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Erro ao atualizar configurações');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao atualizar',
		};
	}
}

// ============================================================================
// PREFERENCES TOOLS
// ============================================================================

/**
 * Tool: get_assistant_name
 * Retorna o nome customizado do assistente (ou null para default)
 */
export async function get_assistant_name(context: ToolContext, _params: {}): Promise<ToolOutput> {
	try {
		const { preferencesService } = await import('@/services/preferences-service');
		const name = await preferencesService.getAssistantName(context.userId);

		return {
			success: true,
			data: { name: name || 'Nexo' },
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Erro ao buscar nome do assistente');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao buscar preferências',
		};
	}
}

// ============================================================================
// MEMORY SEARCH TOOLS (OpenClaw Pattern)
// ============================================================================

/**
 * Tool: memory_search
 * Search user memory using hybrid vector + keyword search
 */
export async function memory_search(
	context: ToolContext,
	params: {
		query: string;
		maxResults?: number;
		types?: string[];
	},
): Promise<ToolOutput> {
	try {
		const { searchMemory } = await import('@/services/memory-search');

		const results = await searchMemory({
			query: params.query,
			userId: context.userId,
			maxResults: params.maxResults || 10,
			types: params.types,
		});

		loggers.tools.info({ query: params.query, resultsCount: results.length }, '✅ Memory search tool executed');

		return {
			success: true,
			data: {
				results: results.map((r) => ({
					id: r.id,
					type: r.type,
					title: r.title,
					metadata: r.metadata,
					score: r.score,
				})),
				count: results.length,
			},
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Memory search tool failed');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao buscar memória',
		};
	}
}

/**
 * Tool: memory_get
 * Get specific memory item by ID
 */
export async function memory_get(
	context: ToolContext,
	params: {
		id: string;
	},
): Promise<ToolOutput> {
	try {
		const { getMemoryItem } = await import('@/services/memory-search');

		const item = await getMemoryItem(params.id, context.userId);

		if (!item) {
			return {
				success: false,
				error: 'Item não encontrado',
			};
		}

		return {
			success: true,
			data: {
				id: item.id,
				type: item.type,
				title: item.title,
				metadata: item.metadata,
			},
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Memory get tool failed');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao buscar item',
		};
	}
}

/**
 * Tool: daily_log_search
 * Search daily logs for specific date or content
 */
export async function daily_log_search(
	context: ToolContext,
	params: {
		date?: string; // YYYY-MM-DD format
		query?: string;
	},
): Promise<ToolOutput> {
	try {
		const { searchDailyLogs } = await import('@/services/memory-search');

		const logs = await searchDailyLogs({
			userId: context.userId,
			date: params.date,
			query: params.query,
		});

		return {
			success: true,
			data: {
				logs,
				count: logs.length,
			},
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Daily log search tool failed');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao buscar diário',
		};
	}
}

// ============================================================================
// INTEGRATION TOOLS - Calendar, Todo, Reminders
// ============================================================================

/**
 * Tool: list_calendar_events
 * List events from Google Calendar
 */
export async function list_calendar_events(
	context: ToolContext,
	params: {
		startDate?: string; // ISO string or natural language date
		endDate?: string; // ISO string or natural language date
		maxResults?: number;
	},
): Promise<ToolOutput> {
	try {
		const { hasGoogleCalendarConnected, listCalendarEvents } = await import(
			'@/services/integrations/google-calendar.service'
		);

		// Check if user has connected Google Calendar
		const isConnected = await hasGoogleCalendarConnected(context.userId);
		if (!isConnected) {
			return {
				success: false,
				error: 'Você precisa conectar sua conta Google primeiro. Use o link no dashboard para conectar.',
			};
		}

		// Parse dates if provided
		let startDate: Date | undefined;
		let endDate: Date | undefined;

		if (params.startDate) {
			const { parseNaturalDate } = await import('@/services/date-parser');
			startDate = await parseNaturalDate(params.startDate);
		}

		if (params.endDate) {
			const { parseNaturalDate } = await import('@/services/date-parser');
			endDate = await parseNaturalDate(params.endDate);
		}

		const events = await listCalendarEvents(context.userId, startDate, endDate, params.maxResults || 10);

		return {
			success: true,
			data: {
				events: events.map((e) => ({
					id: e.id,
					title: e.title,
					description: e.description,
					start: e.start.toISOString(),
					end: e.end?.toISOString(),
					location: e.location,
				})),
				count: events.length,
			},
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Erro ao listar eventos do calendário');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao listar eventos',
		};
	}
}

/**
 * Tool: create_calendar_event
 * Create an event in Google Calendar
 */
export async function create_calendar_event(
	context: ToolContext,
	params: {
		title: string;
		startDate: string; // ISO string or natural language date
		endDate?: string; // ISO string or natural language date
		description?: string;
		duration?: number; // Duration in minutes (used if endDate not provided)
		location?: string;
	},
): Promise<ToolOutput> {
	try {
		const { hasGoogleCalendarConnected, createCalendarEvent: createEvent } = await import(
			'@/services/integrations/google-calendar.service'
		);

		// Check if user has connected Google Calendar
		const isConnected = await hasGoogleCalendarConnected(context.userId);
		if (!isConnected) {
			return {
				success: false,
				error: 'Você precisa conectar sua conta Google primeiro. Use o link no dashboard para conectar.',
			};
		}

		// Parse start date
		const { parseNaturalDate } = await import('@/services/date-parser');
		const startDate = await parseNaturalDate(params.startDate);

		// Parse end date or calculate from duration
		let endDate: Date | undefined;
		if (params.endDate) {
			endDate = await parseNaturalDate(params.endDate);
		} else if (params.duration) {
			endDate = new Date(startDate.getTime() + params.duration * 60 * 1000);
		} else {
			// Default: 1 hour
			endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
		}

		const eventId = await createEvent(context.userId, {
			title: params.title,
			description: params.description,
			startDate,
			endDate,
			location: params.location,
		});

		return {
			success: true,
			message: `Evento "${params.title}" criado com sucesso para ${startDate.toLocaleString('pt-BR')}`,
			data: { eventId },
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Erro ao criar evento no calendário');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao criar evento',
		};
	}
}

/**
 * Tool: list_todos
 * List tasks from Microsoft To Do
 */
export async function list_todos(context: ToolContext, _params: {}): Promise<ToolOutput> {
	try {
		const { hasMicrosoftTodoConnected, listTasks } = await import('@/services/integrations/microsoft-todo.service');

		// Check if user has connected Microsoft To Do
		const isConnected = await hasMicrosoftTodoConnected(context.userId);
		if (!isConnected) {
			return {
				success: false,
				error: 'Você precisa conectar sua conta Microsoft primeiro. Use o link no dashboard para conectar.',
			};
		}

		const tasks = await listTasks(context.userId);

		return {
			success: true,
			data: {
				tasks: tasks.map((t) => ({
					id: t.id,
					title: t.title,
					description: t.description,
					dueDateTime: t.dueDateTime?.toISOString(),
					isCompleted: t.isCompleted,
				})),
				count: tasks.length,
			},
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Erro ao listar tarefas');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao listar tarefas',
		};
	}
}

/**
 * Tool: create_todo
 * Create a task in Microsoft To Do
 */
export async function create_todo(
	context: ToolContext,
	params: {
		title: string;
		description?: string;
		dueDate?: string; // ISO string or natural language date
	},
): Promise<ToolOutput> {
	try {
		const { hasMicrosoftTodoConnected, createTask } = await import('@/services/integrations/microsoft-todo.service');

		// Check if user has connected Microsoft To Do
		const isConnected = await hasMicrosoftTodoConnected(context.userId);
		if (!isConnected) {
			return {
				success: false,
				error: 'Você precisa conectar sua conta Microsoft primeiro. Use o link no dashboard para conectar.',
			};
		}

		// Parse due date if provided
		let dueDateTime: Date | undefined;
		if (params.dueDate) {
			const { parseNaturalDate } = await import('@/services/date-parser');
			dueDateTime = await parseNaturalDate(params.dueDate);
		}

		const taskId = await createTask(context.userId, {
			title: params.title,
			description: params.description,
			dueDateTime,
		});

		return {
			success: true,
			message: `Tarefa "${params.title}" criada com sucesso`,
			data: { taskId },
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Erro ao criar tarefa');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao criar tarefa',
		};
	}
}

/**
 * Tool: schedule_reminder
 * Schedule a reminder to be sent at a specific time
 */
export async function schedule_reminder(
	context: ToolContext,
	params: {
		title: string;
		description?: string;
		when: string; // Natural language date/time
	},
): Promise<ToolOutput> {
	try {
		if (!context.provider || !context.externalId) {
			return {
				success: false,
				error: 'Não foi possível identificar o canal para enviar o lembrete',
			};
		}

		// Parse the date
		const { parseNaturalDate } = await import('@/services/date-parser');
		const scheduledFor = await parseNaturalDate(params.when);

		// Schedule the reminder
		const { scheduleReminder } = await import('@/services/scheduler-service');
		const reminderId = await scheduleReminder({
			userId: context.userId,
			title: params.title,
			description: params.description,
			scheduledFor,
			provider: context.provider,
			externalId: context.externalId,
		});

		return {
			success: true,
			message: `Lembrete agendado para ${scheduledFor.toLocaleString('pt-BR')}`,
			data: { reminderId, scheduledFor: scheduledFor.toISOString() },
		};
	} catch (error) {
		loggers.tools.error({ err: error }, '❌ Erro ao agendar lembrete');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao agendar lembrete',
		};
	}
}

// ============================================================================
// CONTEXT RESOLUTION TOOL
// ============================================================================

/**
 * Resolve uma referência contextual do usuário ("esse primeiro", "aquele filme", "era esse")
 * buscando nas mensagens recentes do assistente para identificar a entidade referenciada.
 *
 * IMPORTANTE: Esta tool NUNCA chama save_*. Ela apenas resolve a referência e retorna
 * { resolved, type } para que o LLM chame enrich_movie/enrich_tv_show e acione o
 * pipeline de confirmação existente.
 */
export async function resolve_context_reference(
	context: ToolContext,
	params: { reference_hint: string },
): Promise<ToolOutput> {
	const { conversationId } = context;
	const { reference_hint } = params;

	const history = await conversationService.getHistory(conversationId, 6);
	const assistantMessages = history.filter((m) => m.role === 'assistant').reverse(); // mais recentes primeiro

	if (assistantMessages.length === 0) {
		return {
			success: false,
			error: 'Nenhuma mensagem do assistente encontrada no histórico recente.',
		};
	}

	// Padrões para extrair entidades das mensagens do assistente
	// Exemplos: 'Interstellar', "The Bear", como 'Foo', seria 'Bar'
	const entityPatterns = [
		/['"]([^'"]{2,60})['"]/g, // texto entre aspas simples ou duplas
		/(?:como|seria|parece|chama(?:do)?|título|chamado)\s+['"]?([A-Z][\w\s:–-]{1,50})['"]?/gi,
		/(?:^|\n)\d+[.)\s]+([A-Z][\w\s:–-]{1,50})/gm, // itens numerados ("1. Interstellar")
	];

	interface Candidate {
		entity: string;
		type: 'movie' | 'tv_show' | 'video' | 'link' | 'note' | null;
		source: string;
	}

	const candidates: Candidate[] = [];

	for (const msg of assistantMessages) {
		for (const pattern of entityPatterns) {
			let match: RegExpExecArray | null;
			const re = new RegExp(pattern.source, pattern.flags);
			while ((match = re.exec(msg.content)) !== null) {
				const entity = match[1]?.trim();
				if (entity && entity.length >= 2) {
					candidates.push({ entity, type: null, source: msg.content.slice(0, 120) });
				}
			}
		}
		if (candidates.length > 0) break; // usar mensagem mais recente com matches
	}

	if (candidates.length === 0) {
		return {
			success: false,
			error: 'Não consegui identificar o item referenciado nas mensagens recentes.',
		};
	}

	// Heurística simples: pegar o primeiro candidato (mais relevante no contexto)
	const best = candidates[0];

	loggers.tools.info(
		{ reference_hint, resolved: best.entity, candidatesCount: candidates.length },
		'🔍 resolve_context_reference',
	);

	return {
		success: true,
		data: {
			resolved: best.entity,
			type: best.type,
			confidence: candidates.length === 1 ? 0.9 : 0.7,
			source_message: best.source,
		},
	};
}

// ============================================================================
// REGISTRO DE TOOLS
// ============================================================================

export const AVAILABLE_TOOLS = {
	// Save tools (específicas)
	save_note,
	save_movie,
	save_tv_show,
	save_video,
	save_link,

	// Search tools
	search_items,

	// Enrichment tools
	enrich_movie,
	enrich_tv_show,
	enrich_video,

	// Delete tools (determinísticos)
	delete_memory,
	delete_all_memories,

	// Preferences tools
	get_assistant_name,
	update_user_settings,

	// Memory search tools (OpenClaw pattern)
	memory_search,
	memory_get,
	daily_log_search,

	// Integration tools
	list_calendar_events,
	create_calendar_event,
	list_todos,
	create_todo,
	schedule_reminder,

	// Context resolution
	resolve_context_reference,
} as const;

export type ToolName = keyof typeof AVAILABLE_TOOLS;

/**
 * Executor genérico de tool
 */
export async function executeTool(toolName: ToolName, context: ToolContext, params: any): Promise<ToolOutput> {
	return startSpan('tool.execute', async (_span) => {
		setAttributes({
			'tool.name': toolName,
			'tool.user_id': context.userId,
			'tool.conversation_id': context.conversationId,
			'tool.params_count': Object.keys(params).length,
		});

		const tool = AVAILABLE_TOOLS[toolName];

		if (!tool) {
			setAttributes({ 'tool.status': 'not_found' });
			return {
				success: false,
				error: `Tool "${toolName}" não existe`,
			};
		}

		loggers.tools.info({ toolName }, '🔧 Executando tool');
		loggers.tools.info({ params }, '📦 Params da tool');

		try {
			const result = await startSpan(`tool.${toolName}`, async () => {
				const toolResult = await tool(context, params);
				setAttributes({
					'tool.success': toolResult.success,
					'tool.has_data': !!toolResult.data,
				});
				return toolResult;
			});
			loggers.tools.info({ toolName, success: result.success }, '✅ Tool executada');
			return result;
		} catch (error) {
			setAttributes({ 'tool.status': 'error' });
			loggers.tools.error(
				{ err: error instanceof Error ? error : new Error(String(error)), toolName },
				`❌ ToolExecutionError: falha na execução da tool '${toolName}'`,
			);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Erro desconhecido',
			};
		}
	});
}
