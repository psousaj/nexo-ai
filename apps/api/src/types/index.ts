import { loggers } from '@/utils/logger';

// Types básicos do sistema

// Re-export shared types
// Re-export shared types
import type { ItemType, ItemMetadata, MovieMetadata, TVShowMetadata, VideoMetadata, LinkMetadata, NoteMetadata } from '@nexo/shared';
export type { ItemType, ItemMetadata, MovieMetadata, TVShowMetadata, VideoMetadata, LinkMetadata, NoteMetadata };

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

// ============================================================================
// OPENCLAW-INSPIRED TYPES
// ============================================================================

/**
 * Session key parameters (OpenClaw pattern)
 */
export interface SessionKeyParams {
	/** Agent identifier (default: 'main') */
	agentId?: string;
	/** Channel: telegram, discord, whatsapp, web */
	channel: string;
	/** Account ID for multi-account support */
	accountId?: string;
	/** Peer kind: direct, group, channel */
	peerKind: 'direct' | 'group' | 'channel';
	/** Peer ID: userId, groupId, channelId */
	peerId: string;
	/** Isolation scope for DMs */
	dmScope?: 'main' | 'per-peer' | 'per-channel-peer' | 'per-account-channel-peer';
}

/**
 * Parsed session key components
 */
export interface SessionKeyParts {
	agentId: string;
	channel: string;
	accountId?: string;
	peerKind: string;
	peerId: string;
	dmScope?: string;
}

/**
 * Agent context built from user profile (OpenClaw pattern)
 */
export interface AgentContext {
	/** Complete system prompt with all sections */
	systemPrompt: string;
	/** Individual sections for fine-grained control */
	agentsContent?: string;
	soulContent?: string;
	identityContent?: string;
	userContent?: string;
	toolsContent?: string;
	memoryContent?: string;
	/** Assistant personality fields */
	assistantName?: string;
	assistantEmoji?: string;
	assistantCreature?: string;
	assistantTone?: string;
	assistantVibe?: string;
}

/**
 * Agent session record
 */
export interface AgentSession {
	id: string;
	sessionKey: string;
	agentId: string;
	channel: string;
	accountId: string | null;
	peerKind: string;
	peerId: string;
	userId: string | null;
	conversationId: string | null;
	model: string | null;
	thinkingLevel: string | null;
	createdAt: string;
	updatedAt: string;
	lastActivityAt: string;
	dmScope: string;
}

/**
 * Agent memory profile record
 */
export interface AgentMemoryProfile {
	id: string;
	userId: string;
	agentsContent: string | null;
	soulContent: string | null;
	identityContent: string | null;
	userContent: string | null;
	toolsContent: string | null;
	memoryContent: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * Chat command interface (for future slash commands)
 */
export interface ChatCommand {
	name: string;
	description: string;
	aliases?: string[];
	handler: (params: CommandParams) => Promise<string>;
	allowedInGroups?: boolean;
	requireAuth?: boolean;
}

/**
 * Command parameters
 */
export interface CommandParams {
	userId: string;
	conversationId: string;
	sessionKey: string;
	args?: string;
	provider: string;
}

/**
 * Memory search options (for hybrid search)
 */
export interface MemorySearchOptions {
	query: string;
	userId: string;
	maxResults?: number;
	minScore?: number;
	types?: string[];
	includeDailyLogs?: boolean;
}

/**
 * Memory search result
 */
export interface MemorySearchResult {
	id: string;
	type: string;
	title: string;
	content: string;
	metadata: any;
	score: number;
	source: 'memory' | 'daily_log';
}
