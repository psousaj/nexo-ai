/**
 * Tool Registry
 *
 * Define todas as tools disponíveis no sistema com metadados
 * para exibição no dashboard admin e gerenciamento via banco de dados.
 */

import type { ToolName } from './index';

export interface ToolDefinition {
	name: ToolName;
	label: string; // Nome amigável para exibição
	description: string; // Descrição curta
	icon: string; // Emoji para o dashboard
	category: 'system' | 'user'; // system = sempre habilitada, user = plugável
	defaultEnabled?: boolean; // undefined = true; false = desabilitada por padrão (Em breve)
	oauthRequired?: 'google' | 'microsoft'; // preparação futura para gate por OAuth
}

// Mapeamento completo de todas as 21 tools com descrições e ícones
const TOOL_DEFINITIONS: Record<ToolName, ToolDefinition> = {
	// ============================================================================
	// SAVE TOOLS (User Tools - podem ser desabilitadas)
	// ============================================================================

	save_note: {
		name: 'save_note',
		label: 'Salvar Nota',
		description: 'Salva texto como nota rápida',
		icon: '📝',
		category: 'user',
	},

	save_movie: {
		name: 'save_movie',
		label: 'Salvar Filme',
		description: 'Salva filme com metadados do TMDB',
		icon: '🎬',
		category: 'user',
	},

	save_tv_show: {
		name: 'save_tv_show',
		label: 'Salvar Série',
		description: 'Salva série de TV com metadados',
		icon: '📺',
		category: 'user',
	},

	save_video: {
		name: 'save_video',
		label: 'Salvar Vídeo',
		description: 'Salva link do YouTube',
		icon: '🎥',
		category: 'user',
	},

	save_link: {
		name: 'save_link',
		label: 'Salvar Link',
		description: 'Salva URL genérica',
		icon: '🔗',
		category: 'user',
	},

	// ============================================================================
	// SEARCH TOOLS (System Tools - sempre habilitadas)
	// ============================================================================

	search_items: {
		name: 'search_items',
		label: 'Buscar Itens',
		description: 'Busca itens salvos por título',
		icon: '🔍',
		category: 'system',
	},

	// ============================================================================
	// ENRICHMENT TOOLS (System Tools)
	// ============================================================================

	enrich_movie: {
		name: 'enrich_movie',
		label: 'Buscar Filme',
		description: 'Busca filme no TMDB',
		icon: '🎬',
		category: 'system',
	},

	enrich_tv_show: {
		name: 'enrich_tv_show',
		label: 'Buscar Série',
		description: 'Busca série no TMDB',
		icon: '📺',
		category: 'system',
	},

	enrich_video: {
		name: 'enrich_video',
		label: 'Metadados Vídeo',
		description: 'Busca info do YouTube',
		icon: '🎥',
		category: 'system',
	},

	// ============================================================================
	// DELETE TOOLS (System Tools)
	// ============================================================================

	delete_memory: {
		name: 'delete_memory',
		label: 'Deletar Item',
		description: 'Remove item específico',
		icon: '🗑️',
		category: 'system',
	},

	delete_all_memories: {
		name: 'delete_all_memories',
		label: 'Limpar Tudo',
		description: 'Remove todos os itens salvos',
		icon: '🧹',
		category: 'system',
	},

	// ============================================================================
	// PREFERENCES TOOLS (System Tools)
	// ============================================================================

	get_assistant_name: {
		name: 'get_assistant_name',
		label: 'Nome do Assistente',
		description: 'Ver nome customizado do assistente',
		icon: '🤖',
		category: 'system',
	},

	update_user_settings: {
		name: 'update_user_settings',
		label: 'Configurar Assistente',
		description: 'Altera nome do assistente',
		icon: '⚙️',
		category: 'system',
	},

	// ============================================================================
	// MEMORY SEARCH TOOLS (System Tools)
	// ============================================================================

	memory_search: {
		name: 'memory_search',
		label: 'Buscar Memória',
		description: 'Busca vetorial + keywords (OpenClaw)',
		icon: '🧠',
		category: 'system',
	},

	memory_get: {
		name: 'memory_get',
		label: 'Ver Item',
		description: 'Busca item específico por ID',
		icon: '📄',
		category: 'system',
	},

	daily_log_search: {
		name: 'daily_log_search',
		label: 'Diário do Dia',
		description: 'Busca logs de data específica',
		icon: '📅',
		category: 'system',
	},

	// ============================================================================
	// INTEGRATION TOOLS (System Tools)
	// ============================================================================

	list_calendar_events: {
		name: 'list_calendar_events',
		label: 'Eventos Agenda',
		description: 'Lista Google Calendar',
		icon: '📆',
		category: 'system',
	},

	create_calendar_event: {
		name: 'create_calendar_event',
		label: 'Criar Evento',
		description: 'Adiciona ao Google Calendar',
		icon: '➕',
		category: 'system',
	},

	list_todos: {
		name: 'list_todos',
		label: 'Tarefas Microsoft',
		description: 'Lista Microsoft To Do',
		icon: '✅',
		category: 'system',
	},

	create_todo: {
		name: 'create_todo',
		label: 'Criar Tarefa',
		description: 'Adiciona ao Microsoft To Do',
		icon: '➕',
		category: 'system',
	},

	schedule_reminder: {
		name: 'schedule_reminder',
		label: 'Agendar Lembrete',
		description: 'Lembrete via chat (Telegram/WhatsApp)',
		icon: '⏰',
		category: 'system',
	},

	resolve_context_reference: {
		name: 'resolve_context_reference',
		label: 'Resolver Referência',
		description: 'Resolve referências de contexto em mensagens',
		icon: '🔍',
		category: 'system',
	},

	// ============================================================================
	// WEB SEARCH + URL ANALYSIS (System Tools — sempre habilitadas)
	// ============================================================================

	web_search: {
		name: 'web_search',
		label: 'Busca na Web',
		description: 'Busca na internet via Brave Search (read-only)',
		icon: '🌐',
		category: 'system',
	},

	analyze_url: {
		name: 'analyze_url',
		label: 'Analisar URL',
		description: 'Detecta tipo de conteúdo de uma URL (ferramenta interna)',
		icon: '🔗',
		category: 'system',
	},

	// ============================================================================
	// NOVOS TIPOS DE CONTEÚDO — defaultEnabled: true para memo, false para demais
	// ============================================================================

	save_memo: {
		name: 'save_memo',
		label: 'Salvar Memo',
		description: 'Salva memória avulsa sem categoria (pensamento, quote, ideia)',
		icon: '🗒️',
		category: 'user',
		// defaultEnabled omitido = true por padrão
	},

	save_book: {
		name: 'save_book',
		label: 'Salvar Livro',
		description: 'Salva livro com metadados do Google Books',
		icon: '📚',
		category: 'user',
	},

	save_music: {
		name: 'save_music',
		label: 'Salvar Música',
		description: 'Salva música com metadados do Spotify',
		icon: '🎵',
		category: 'user',
	},

	save_image: {
		name: 'save_image',
		label: 'Salvar Imagem',
		description: 'Salva imagem com extração de metadados EXIF',
		icon: '🖼️',
		category: 'user',
	},
};

/**
 * Retorna TODAS as tools de sistema (sempre habilitadas)
 * System tools são todas exceto as 5 tools de salvamento (user tools)
 */
const USER_TOOL_NAMES: ToolName[] = [
	'save_note',
	'save_movie',
	'save_tv_show',
	'save_video',
	'save_link',
	'save_memo',
	'save_book',
	'save_music',
	'save_image',
];

export function getSystemTools(): ToolDefinition[] {
	return Object.entries(TOOL_DEFINITIONS)
		.filter(([name]) => !USER_TOOL_NAMES.includes(name as ToolName))
		.map(([, def]) => def);
}

/**
 * Retorna tools de usuário (plugáveis, podem ser desabilitadas)
 */
export function getUserTools(): ToolDefinition[] {
	return USER_TOOL_NAMES.map((name) => TOOL_DEFINITIONS[name]);
}

/**
 * Retorna definição de uma tool específica
 */
export function getToolDefinition(name: ToolName): ToolDefinition | undefined {
	return TOOL_DEFINITIONS[name];
}

/**
 * Verifica se é system tool (sempre habilitada)
 */
export function isSystemTool(name: ToolName): boolean {
	return !USER_TOOL_NAMES.includes(name);
}

/**
 * Retorna TODAS as tools (system + user)
 */
export function getAllTools(): ToolDefinition[] {
	return Object.values(TOOL_DEFINITIONS);
}
