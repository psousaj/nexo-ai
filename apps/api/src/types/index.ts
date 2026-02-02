import { loggers } from '@/utils/logger';

// Types básicos do sistema

export type ItemType = 'movie' | 'tv_show' | 'video' | 'link' | 'note';

export type ConversationState =
	| 'idle' // Conversa inativa, pronta para receber comandos
	| 'processing' // Ação em andamento (evita concorrência)
	| 'awaiting_context' // Aguardando contexto do usuário
	| 'off_topic_chat' // Usuário entrou em conversa paralela fora do escopo
	| 'awaiting_confirmation' // Aguardando confirmação do usuário (lista com botões)
	| 'awaiting_final_confirmation' // Aguardando confirmação final com imagem
	| 'enriching' // Buscando informações adicionais
	| 'saving' // Salvando o conteúdo
	| 'error' // Estado de erro
	| 'waiting_close' // Ação finalizada, timer de 3min agendado
	| 'closed'; // Conversa encerrada, contexto limpo

export type MessageRole = 'user' | 'assistant';

/**
 * Schema canônico de resposta do agente (LLM)
 *
 * TODA resposta da LLM deve seguir este formato sem exceções.
 */
export type AgentAction = 'CALL_TOOL' | 'RESPOND' | 'NOOP';

export type ToolName =
	| 'save_note'
	| 'save_movie'
	| 'save_tv_show'
	| 'save_video'
	| 'save_link'
	| 'search_items'
	| 'enrich_movie'
	| 'enrich_tv_show'
	| 'enrich_video';

export interface AgentLLMResponse {
	schema_version: string; // Versionamento para compatibilidade futura
	action: AgentAction;
	tool?: ToolName | null;
	args?: Record<string, any> | null;
	message?: string | null;
}

const CURRENT_SCHEMA_VERSION = '1.0';

/**
 * Validação de schema
 */
export function validateAgentResponse(response: any): response is AgentLLMResponse {
	if (!response || typeof response !== 'object') return false;

	// Validar schema_version
	if (response.schema_version !== CURRENT_SCHEMA_VERSION) {
		loggers.ai.warn({ version: response.schema_version, expected: CURRENT_SCHEMA_VERSION }, 'Versão de schema incompatível');
	}

	if (!['CALL_TOOL', 'RESPOND', 'NOOP'].includes(response.action)) return false;

	if (response.action === 'CALL_TOOL') {
		if (!response.tool) return false;
	}

	// Validar tamanho de RESPOND (máx 200 chars)
	if (response.action === 'RESPOND' && response.message) {
		if (response.message.length > 200) {
			loggers.ai.warn({ length: response.message.length }, 'RESPOND muito longo');
			response.message = response.message.substring(0, 197) + '...';
		}
	}

	if (response.action === 'NOOP') {
		if (response.message !== null && response.message !== undefined) return false;
	}

	return true;
}

// Metadata por tipo de item
export interface MovieMetadata {
	tmdb_id: number;
	year: number;
	genres: string[];
	rating: number;
	streaming?: Array<{
		provider: string;
		url: string;
	}>;
	poster_url?: string;
	director?: string;
	cast?: string[];
	// 🔥 Campos para enrichment semântico
	overview?: string; // Sinopse do filme
	tagline?: string; // Frase de efeito
	keywords?: string[]; // Keywords TMDB (CRÍTICO para busca)
}

export interface TVShowMetadata {
	tmdb_id: number;
	first_air_date: number; // Ano de estreia
	last_air_date?: number; // Ano do último episódio
	number_of_seasons: number;
	number_of_episodes: number;
	status: string; // "Ended", "Returning Series", etc
	genres: string[];
	rating: number;
	streaming?: Array<{
		provider: string;
		url: string;
	}>;
	poster_url?: string;
	created_by?: string[];
	cast?: string[];
	// 🔥 Campos para enrichment semântico
	overview?: string; // Sinopse da série
	tagline?: string; // Frase de efeito
	keywords?: string[]; // Keywords TMDB (CRÍTICO para busca)
}

export interface VideoMetadata {
	video_id: string;
	platform: 'youtube' | 'vimeo';
	channel_name: string;
	duration: number;
	views?: number;
	thumbnail_url?: string;
}

export interface LinkMetadata {
	url: string;
	og_title?: string;
	og_description?: string;
	og_image?: string;
	domain?: string;
}

export interface NoteMetadata {
	full_content?: string;
	category?: string;
	related_topics?: string[];
	priority?: 'low' | 'medium' | 'high';
	created_via?: 'chat' | 'api';
}

export type ItemMetadata = MovieMetadata | TVShowMetadata | VideoMetadata | LinkMetadata | NoteMetadata;

// Contexto de conversação
export interface ConversationContext {
	awaiting_selection?: boolean;
	candidates?: any[];
	last_query?: string;
	detected_type?: ItemType;
	pendingClarification?: {
		originalMessage: string;
		detectedType: string | null;
		clarificationOptions: string[];
	};
	clarificationAttempts?: number; // Contador de tentativas de clarificação
	lastClarificationMessage?: string; // Última mensagem original antes de off_topic

	// Batch processing
	batch_queue?: Array<{
		query: string;
		type: ItemType;
		status: 'pending' | 'processing' | 'confirmed' | 'skipped';
	}>;
	batch_current_index?: number; // Índice do item atual na fila
	batch_current_candidates?: any[]; // Candidatos do item atual
	batch_confirmed_items?: any[]; // Itens já confirmados

	[key: string]: any;
}

// Re-export AI types from ai service
export type { AIResponse, Message, AIProvider, AIProviderType } from '@/services/ai/types';
