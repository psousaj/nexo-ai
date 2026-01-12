/**
 * Definições de Tools para AI com Function Calling
 * Tools específicas alinhadas com /src/services/tools/index.ts
 */

export interface Tool {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<string, any>;
		required: string[];
	};
}

// ============================================================================
// SAVE TOOLS - Específicas por tipo
// ============================================================================

export const saveNoteTool: Tool = {
	name: 'save_note',
	description: 'Salva uma nota/anotação/lembrete pessoal do usuário. Use para ideias, lembretes, pensamentos.',
	parameters: {
		type: 'object',
		properties: {
			content: {
				type: 'string',
				description: 'Conteúdo completo da nota',
			},
		},
		required: ['content'],
	},
};

export const saveMovieTool: Tool = {
	name: 'save_movie',
	description: 'Salva um filme na biblioteca. Use após enrich_movie confirmar qual filme.',
	parameters: {
		type: 'object',
		properties: {
			title: {
				type: 'string',
				description: 'Título do filme',
			},
			year: {
				type: 'number',
				description: 'Ano de lançamento',
			},
			tmdb_id: {
				type: 'number',
				description: 'ID do TMDB (obrigatório após enrichment)',
			},
		},
		required: ['title'],
	},
};

export const saveTVShowTool: Tool = {
	name: 'save_tv_show',
	description: 'Salva uma série na biblioteca. Use após enrich_tv_show confirmar qual série.',
	parameters: {
		type: 'object',
		properties: {
			title: {
				type: 'string',
				description: 'Título da série',
			},
			year: {
				type: 'number',
				description: 'Ano de estreia',
			},
			tmdb_id: {
				type: 'number',
				description: 'ID do TMDB (obrigatório após enrichment)',
			},
		},
		required: ['title'],
	},
};

export const saveVideoTool: Tool = {
	name: 'save_video',
	description: 'Salva um vídeo do YouTube/Vimeo.',
	parameters: {
		type: 'object',
		properties: {
			url: {
				type: 'string',
				description: 'URL completa do vídeo',
			},
			title: {
				type: 'string',
				description: 'Título do vídeo (opcional)',
			},
		},
		required: ['url'],
	},
};

export const saveLinkTool: Tool = {
	name: 'save_link',
	description: 'Salva um link/URL genérico (artigos, sites, etc).',
	parameters: {
		type: 'object',
		properties: {
			url: {
				type: 'string',
				description: 'URL completa',
			},
			description: {
				type: 'string',
				description: 'Descrição do link (opcional)',
			},
		},
		required: ['url'],
	},
};

// ============================================================================
// SEARCH TOOLS
// ============================================================================

export const searchItemsTool: Tool = {
	name: 'search_items',
	description: 'Busca itens salvos na biblioteca do usuário.',
	parameters: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: 'Termo de busca (opcional)',
			},
			limit: {
				type: 'number',
				description: 'Máximo de resultados (padrão: 10)',
			},
		},
		required: [],
	},
};

// ============================================================================
// ENRICHMENT TOOLS
// ============================================================================

export const enrichMovieTool: Tool = {
	name: 'enrich_movie',
	description: 'Busca informações de um filme no TMDB. SEMPRE use antes de save_movie.',
	parameters: {
		type: 'object',
		properties: {
			title: {
				type: 'string',
				description: 'Título do filme',
			},
			year: {
				type: 'number',
				description: 'Ano (opcional, ajuda a filtrar)',
			},
		},
		required: ['title'],
	},
};

export const enrichTVShowTool: Tool = {
	name: 'enrich_tv_show',
	description: 'Busca informações de uma série no TMDB. SEMPRE use antes de save_tv_show.',
	parameters: {
		type: 'object',
		properties: {
			title: {
				type: 'string',
				description: 'Título da série',
			},
			year: {
				type: 'number',
				description: 'Ano (opcional)',
			},
		},
		required: ['title'],
	},
};

export const enrichVideoTool: Tool = {
	name: 'enrich_video',
	description: 'Busca metadata de um vídeo do YouTube.',
	parameters: {
		type: 'object',
		properties: {
			url: {
				type: 'string',
				description: 'URL do vídeo',
			},
		},
		required: ['url'],
	},
};

// ============================================================================
// DELETE TOOLS
// ============================================================================

export const deleteItemsTool: Tool = {
	name: 'delete_items',
	description: 'Deleta itens específicos da biblioteca.',
	parameters: {
		type: 'object',
		properties: {
			itemIds: {
				type: 'array',
				items: {
					type: 'string',
				},
				description: 'IDs dos itens a deletar',
			},
		},
		required: ['itemIds'],
	},
};

/**
 * Lista de todas as tools disponíveis (alinhada com tools/index.ts)
 */
export const availableTools: Tool[] = [
	// Save tools específicas
	saveNoteTool,
	saveMovieTool,
	saveTVShowTool,
	saveVideoTool,
	saveLinkTool,
	// Search
	searchItemsTool,
	// Enrichment
	enrichMovieTool,
	enrichTVShowTool,
	enrichVideoTool,
	// Delete
	deleteItemsTool,
];

/**
 * Retorna definições de tools no formato esperado por cada provider
 */
export function getToolsForProvider(provider: 'gemini' | 'cloudflare'): Tool[] {
	// Cloudflare não suporta function calling, retorna vazio
	if (provider === 'cloudflare') {
		return [];
	}

	return availableTools;
}
