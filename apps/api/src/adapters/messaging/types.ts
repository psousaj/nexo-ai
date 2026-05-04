import type { LinkingTokenProvider } from '@/db/schema';
import type { MultimodalIntakePayload } from '@nexo/shared';
import { randomUUID } from 'node:crypto';

/**
 * Messaging Provider Adapter Interface
 *
 * Abstração para diferentes provedores de chat (WhatsApp, Telegram, Discord, etc)
 * Permite integrar múltiplos providers sem acoplar a lógica de negócio
 */

export type ProviderType = LinkingTokenProvider;

/**
 * Canais de messaging suportados no runtime de chat
 */
export type MessagingChannel = Extract<ProviderType, 'whatsapp' | 'telegram' | 'discord'>;

/**
 * Versão atual do envelope canônico entre ingress/workers/adapters
 */
export const MESSAGING_ENVELOPE_VERSION = '1.0' as const;

/**
 * Tipos de evento canônico suportados
 */
export type CanonicalMessageEventType = 'incoming.message.received' | 'outgoing.message.dispatch';

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
	/** Session key (OpenClaw) quando já resolvida no ingresso */
	sessionKey?: string;
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
	/** Origem específica da API quando provider=whatsapp */
	sourceApi?: 'evolution';
	/** JID remoto original (quando aplicável) */
	remoteJid?: string;
	/** Participante original em grupos (quando aplicável) */
	participantJid?: string;
	/** Payload bruto do provider para casos avançados */
	providerPayload?: Record<string, unknown>;
	/** Attachments multimodais mapeados para intake-worker (opcional) */
	attachments?: MultimodalIntakePayload[];
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
 * Envelope canônico versionado para eventos de messaging
 */
export interface CanonicalMessageEnvelope<TPayload = Record<string, unknown>> {
	version: typeof MESSAGING_ENVELOPE_VERSION;
	eventType: CanonicalMessageEventType;
	channel: MessagingChannel;
	eventId: string;
	idempotencyKey: string;
	occurredAt: string;
	traceId?: string;
	payload: TPayload;
}

/**
 * Payload canônico de ingestão para processamento de mensagem
 */
export interface IngestMessageQueuePayload {
	incomingMsg: IncomingMessage;
	providerName: MessagingChannel;
	providerApi?: 'evolution';
}

/**
 * Métodos de entrega suportados no pipeline de saída canônica
 */
export type OutgoingDeliveryMethod = 'send_text' | 'send_buttons' | 'send_photo' | 'send_voice' | 'send_chat_action';

/**
 * Payload canônico de saída para adapter-output queue
 */
export interface OutgoingMessageQueuePayload {
	providerName: MessagingChannel;
	externalId: string;
	deliveryMethod: OutgoingDeliveryMethod;
	text?: string;
	buttons?: unknown[];
	photoUrl?: string;
	caption?: string;
	voiceBuffer?: Buffer;
	voiceMimeType?: string;
	voiceFilename?: string;
	chatAction?: ChatAction;
	options?: Record<string, unknown>;
	metadata?: {
		conversationId?: string;
		userId?: string;
		source?: string;
	};
}

/**
 * Job canônico da fila adapter-output
 */
export type AdapterOutputQueueJob = CanonicalMessageEnvelope<OutgoingMessageQueuePayload>;

/**
 * Formato legado de jobs de ingestão (compatibilidade retroativa)
 */
export interface LegacyIngestMessageQueuePayload {
	incomingMsg: IncomingMessage;
	providerName: ProviderType;
	providerApi?: 'evolution';
}

/**
 * Job de ingestão aceito pela fila (canônico + legado)
 */
export type IngestMessageQueueJob =
	| CanonicalMessageEnvelope<IngestMessageQueuePayload>
	| LegacyIngestMessageQueuePayload;

export function isMessagingChannel(value: string): value is MessagingChannel {
	return value === 'whatsapp' || value === 'telegram' || value === 'discord';
}

function toValidIsoString(value: Date | undefined): string {
	const candidate = value instanceof Date ? value : new Date();
	if (Number.isNaN(candidate.getTime())) {
		return new Date().toISOString();
	}
	return candidate.toISOString();
}

/**
 * Cria envelope canônico para eventos de ingestão
 */
export function createCanonicalIncomingEnvelope(params: {
	incomingMsg: IncomingMessage;
	providerName: MessagingChannel;
	providerApi?: 'evolution';
	traceId?: string;
}): CanonicalMessageEnvelope<IngestMessageQueuePayload> {
	const { incomingMsg, providerName, providerApi, traceId } = params;
	const idempotencyKey = `${providerName}:${incomingMsg.messageId}`;

	return {
		version: MESSAGING_ENVELOPE_VERSION,
		eventType: 'incoming.message.received',
		channel: providerName,
		eventId: `ingress:${idempotencyKey}`,
		idempotencyKey,
		occurredAt: toValidIsoString(incomingMsg.timestamp),
		traceId,
		payload: {
			incomingMsg,
			providerName,
			providerApi,
		},
	};
}

/**
 * Cria envelope canônico para eventos de saída
 */
export function createCanonicalOutgoingEnvelope(params: {
	payload: OutgoingMessageQueuePayload;
	traceId?: string;
	idempotencyKey?: string;
}): AdapterOutputQueueJob {
	const { payload, traceId, idempotencyKey } = params;
	const outputId = idempotencyKey ?? randomUUID();

	return {
		version: MESSAGING_ENVELOPE_VERSION,
		eventType: 'outgoing.message.dispatch',
		channel: payload.providerName,
		eventId: `egress:${outputId}`,
		idempotencyKey: outputId,
		occurredAt: new Date().toISOString(),
		traceId,
		payload,
	};
}

export function isCanonicalIncomingEnvelope(
	data: unknown,
): data is CanonicalMessageEnvelope<IngestMessageQueuePayload> {
	if (!data || typeof data !== 'object') return false;

	const candidate = data as Partial<CanonicalMessageEnvelope<unknown>>;

	return (
		candidate.version === MESSAGING_ENVELOPE_VERSION &&
		candidate.eventType === 'incoming.message.received' &&
		typeof candidate.channel === 'string' &&
		isMessagingChannel(candidate.channel) &&
		typeof candidate.idempotencyKey === 'string' &&
		typeof candidate.occurredAt === 'string' &&
		!!candidate.payload &&
		typeof candidate.payload === 'object'
	);
}

export function isCanonicalOutgoingEnvelope(data: unknown): data is AdapterOutputQueueJob {
	if (!data || typeof data !== 'object') return false;

	const candidate = data as Partial<CanonicalMessageEnvelope<unknown>>;

	if (
		candidate.version !== MESSAGING_ENVELOPE_VERSION ||
		candidate.eventType !== 'outgoing.message.dispatch' ||
		typeof candidate.channel !== 'string' ||
		!isMessagingChannel(candidate.channel) ||
		typeof candidate.idempotencyKey !== 'string' ||
		!candidate.payload ||
		typeof candidate.payload !== 'object'
	) {
		return false;
	}

	const payload = candidate.payload as Partial<OutgoingMessageQueuePayload>;
	return (
		typeof payload.providerName === 'string' &&
		isMessagingChannel(payload.providerName) &&
		typeof payload.externalId === 'string' &&
		typeof payload.deliveryMethod === 'string'
	);
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
	 * Envia mensagem de voz (áudio como voice bubble)
	 * @param chatId - ID do chat/destinatário
	 * @param audioBuffer - Buffer do áudio (Opus .ogg para Telegram, MP3 para outros)
	 * @param mimeType - MIME type do áudio (audio/ogg, audio/mpeg, etc)
	 * @param filename - Nome do arquivo (ex: voice.ogg)
	 */
	sendVoice?(chatId: string, audioBuffer: Buffer, mimeType: string, filename?: string): Promise<void>;

	/**
	 * Responde a callback query (remove loading dos botões)
	 */
	answerCallbackQuery?(callbackQueryId: string, text?: string): Promise<void>;

	// ========== Streaming support ==========

	/**
	 * Envia placeholder e retorna o messageId para edição posterior
	 */
	sendPlaceholder?(chatId: string, text?: string): Promise<string>;

	/**
	 * Edita uma mensagem existente por ID
	 */
	editMessage?(chatId: string, messageId: string, text: string): Promise<void>;

	/**
	 * Limite de caracteres por mensagem do provider
	 */
	getMaxMessageLength?(): number;
}
