/**
 * Tools com contratos fortes - v2
 *
 * Cada tool faz UMA coisa específica.
 * Entradas validadas, saídas previsíveis, zero decisão.
 */

import { itemService } from '@/services/item-service';
import { enrichmentService } from '@/services/enrichment';
import type { ItemType, MovieMetadata, TVShowMetadata, VideoMetadata, LinkMetadata, NoteMetadata } from '@/types';

export interface ToolContext {
	userId: string;
	conversationId: string;
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
	}
): Promise<ToolOutput> {
	if (!params.content?.trim()) {
		return { success: false, error: 'Conteúdo vazio' };
	}

	try {
		const item = await itemService.createItem({
			userId: context.userId,
			type: 'note',
			title: params.content.slice(0, 100),
			metadata: {
				full_content: params.content,
				created_via: 'chat',
			} as NoteMetadata,
		});

		return {
			success: true,
			data: { id: item.item.id, title: item.item.title },
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao salvar nota',
		};
	}
}

/**
 * Tool: save_movie
 * Salva filme (com ou sem enriquecimento)
 */
export async function save_movie(
	context: ToolContext,
	params: {
		title: string;
		year?: number;
		tmdb_id?: number;
	}
): Promise<ToolOutput> {
	if (!params.title?.trim()) {
		return { success: false, error: 'Título vazio' };
	}

	try {
		const item = await itemService.createItem({
			userId: context.userId,
			type: 'movie',
			title: params.title,
			metadata: {
				tmdb_id: params.tmdb_id || 0,
				year: params.year || new Date().getFullYear(),
				genres: [],
				rating: 0,
			} as MovieMetadata,
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
 */
export async function save_tv_show(
	context: ToolContext,
	params: {
		title: string;
		year?: number;
		tmdb_id?: number;
	}
): Promise<ToolOutput> {
	if (!params.title?.trim()) {
		return { success: false, error: 'Título vazio' };
	}

	try {
		const item = await itemService.createItem({
			userId: context.userId,
			type: 'tv_show',
			title: params.title,
			metadata: {
				tmdb_id: params.tmdb_id || 0,
				first_air_date: params.year || new Date().getFullYear(),
				number_of_seasons: 0,
				number_of_episodes: 0,
				status: 'Unknown',
				genres: [],
				rating: 0,
			} as TVShowMetadata,
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
	}
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
	}
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
	}
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
	context: ToolContext,
	params: {
		title: string;
		year?: number;
	}
): Promise<ToolOutput> {
	if (!params.title?.trim()) {
		return { success: false, error: 'Título vazio' };
	}

	try {
		const results = await enrichmentService.searchMovies(params.title);

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
					title: r.title,
					year: r.release_date ? parseInt(r.release_date.split('-')[0]) : undefined,
					tmdb_id: r.id,
					rating: r.vote_average || 0,
					overview: r.overview || '',
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
	context: ToolContext,
	params: {
		title: string;
		year?: number;
	}
): Promise<ToolOutput> {
	if (!params.title?.trim()) {
		return { success: false, error: 'Título vazio' };
	}

	try {
		const results = await enrichmentService.searchTVShows(params.title);

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
					title: r.name,
					year: r.first_air_date,
					tmdb_id: r.id,
					rating: r.rating,
					overview: r.overview,
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
	context: ToolContext,
	params: {
		url: string;
	}
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
	}
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

export async function delete_all_memories(context: ToolContext, params: {}): Promise<ToolOutput> {
	try {
		const deleted_count = await itemService.deleteAllItems(context.userId);

		return {
			success: true,
			data: { deleted_count },
			message: `${deleted_count} item(ns) deletado(s)`,
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
	}
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
		console.error('❌ [Tool] Erro ao atualizar configurações:', error);
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
export async function get_assistant_name(context: ToolContext, params: {}): Promise<ToolOutput> {
	try {
		const { preferencesService } = await import('@/services/preferences-service');
		const name = await preferencesService.getAssistantName(context.userId);

		return {
			success: true,
			data: { name: name || 'Nexo' },
		};
	} catch (error) {
		console.error('❌ [Tool] Erro ao buscar nome do assistente:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao buscar preferências',
		};
	}
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
} as const;

export type ToolName = keyof typeof AVAILABLE_TOOLS;

/**
 * Executor genérico de tool
 */
export async function executeTool(toolName: ToolName, context: ToolContext, params: any): Promise<ToolOutput> {
	const tool = AVAILABLE_TOOLS[toolName];

	if (!tool) {
		return {
			success: false,
			error: `Tool "${toolName}" não existe`,
		};
	}

	console.log(`🔧 [Tool] Executando: ${toolName}`);
	console.log(`📋 [Tool] Params:`, JSON.stringify(params, null, 2));

	try {
		const result = await tool(context, params);
		console.log(`✅ [Tool] ${toolName} executada:`, result.success ? 'sucesso' : 'falha');
		return result;
	} catch (error) {
		console.error(`❌ [Tool] Erro ao executar ${toolName}:`, error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro desconhecido',
		};
	}
}
