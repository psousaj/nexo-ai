import type { LinkingTokenProvider } from '@/db/schema';

/**
 * Messaging Provider Adapter Interface
 *
 * Abstração para diferentes provedores de chat (WhatsApp, Telegram, Discord, etc)
 * Permite integrar múltiplos providers sem acoplar a lógica de negócio
 */

export type ProviderType = LinkingTokenProvider;

/**
 * Chat action type for activity indicators
 */
export type ChatAction =
	| 'typing'
	| 'upload_photo'
	| 'upload_video'
	| 'upload_document'
	| 'find_location'
	| 'record_video'
	| 'record_audio'
	| 'record_video_note';

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
 * Message metadata including group information
 */
export interface MessageMetadata {
	/** Whether the message is from a group/channel */
	isGroupMessage: boolean;
	/** Group/Channel ID (if applicable) */
	groupId?: string;
	/** Group/Channel title */
	groupTitle?: string;
	/** Whether bot was mentioned (in groups) */
	botMentioned?: boolean;
	/** Message type (text, command, etc) */
	messageType: 'text' | 'command' | 'callback' | 'unknown';
}

/**
 * Mensagem normalizada recebida de qualquer provider
 */
export interface IncomingMessage {
	/** ID único da mensagem no provider */
	messageId: string;

	/** ID do remetente no provider (phone, chat_id, user_id, etc) */
	externalId: string;

	/** ID do usuário que enviou (differs from externalId in groups) */
	userId?: string;

	/** Nome do remetente (opcional) */
	senderName?: string;

	/** Username/handle (opcional) */
	username?: string;

	/** Conteúdo da mensagem */
	text: string;

	/** Timestamp da mensagem */
	timestamp: Date;

	/** Provider de origem */
	provider: ProviderType;

	/** Número de telefone (se disponível) para detecção cross-provider */
	phoneNumber?: string;

	/** ID do callback query (Telegram inline buttons) */
	callbackQueryId?: string;

	/** Dados do callback (texto do botão clicado) */
	callbackData?: string;

	/** Token de vinculação (ex: extraído de /start <token> no Telegram) */
	linkingToken?: string;

	/** Message metadata (groups, mentions, etc) */
	metadata?: MessageMetadata;
}

/**
 * Inline query result for search suggestions
 */
export interface ParsedInlineQuery {
	queryId: string;
	query: string;
	userId: string;
	offset?: string;
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
 * Chat command definition
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
 * Interface comum para todos os adapters de messaging (OpenClaw-inspired)
 */
export interface MessagingProvider {
	/**
	 * Parse webhook payload do provider para formato normalizado
	 * @returns IncomingMessage se válido, null se payload inválido/vazio
	 */
	parseIncomingMessage(payload: any): IncomingMessage | null;

	/**
	 * Verifica autenticidade do webhook (HMAC, tokens, etc)
	 * Aceita qualquer tipo de Request (Fetch API ou Express)
	 */
	verifyWebhook(request: any): boolean | Promise<boolean>;

	/**
	 * Envia mensagem de texto para um destinatário
	 * @param recipient - ID do destinatário no formato do provider
	 * @param text - Conteúdo da mensagem (texto puro)
	 */
	sendMessage(recipient: string, text: string, options?: any): Promise<void>;

	/**
	 * Retorna nome do provider
	 */
	getProviderName(): ProviderType;

	// ========== OpenClaw-inspired enhancements ==========

	/**
	 * Envia indicador de atividade (typing, upload_photo, etc)
	 */
	sendTypingIndicator?(chatId: string): Promise<void>;

	/**
	 * Envia ação de chat (typing, upload_photo, etc)
	 */
	sendChatAction?(chatId: string, action: ChatAction): Promise<void>;

	/**
	 * Parse inline query para sugestões de busca
	 */
	parseInlineQuery?(query: any): ParsedInlineQuery | null;

	/**
	 * Envia resultado de inline query
	 */
	sendInlineResult?(params: any): Promise<void>;

	/**
	 * Constroi session key no formato OpenClaw
	 */
	buildSessionKey?(params: SessionKeyParams): string;

	/**
	 * Parse session key em componentes
	 */
	parseSessionKey?(key: string): SessionKeyParts;

	/**
	 * Registra comando de chat
	 */
	registerCommand?(command: ChatCommand): void;

	/**
	 * Executa comando de chat
	 */
	handleCommand?(command: string, params: CommandParams): Promise<void>;

	/**
	 * Marca mensagem como lida
	 */
	markAsRead?(messageId: string): Promise<void>;

	/**
	 * Envia mensagem com botões inline
	 */
	sendMessageWithButtons?(chatId: string, text: string, buttons: any[], options?: any): Promise<void>;

	/**
	 * Envia foto com caption e botões
	 */
	sendPhoto?(chatId: string, photoUrl: string, caption?: string, buttons?: any[], options?: any): Promise<void>;

	/**
	 * Responde a callback query (remove loading dos botões)
	 */
	answerCallbackQuery?(callbackQueryId: string, text?: string): Promise<void>;
}
