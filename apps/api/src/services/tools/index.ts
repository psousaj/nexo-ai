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
		const videoIdMatch = params.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
		if (!videoIdMatch) {
			return {
				success: false,
				error: 'URL inválida do YouTube',
			};
		}

		const videoId = videoIdMatch[1];

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
// DELETE TOOLS
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
