// Função utilitária para escapar MarkdownV2 conforme documentação oficial Telegram
// Remove emojis (Unicode ranges)
function removeEmojis(text: string): string {
	return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
}

function escapeMarkdownV2(text: string): string {
	// Remove emojis para evitar problemas
	let clean = removeEmojis(text);
	// Primeiro escapa a barra invertida para não duplicar
	clean = clean.replace(/\\/g, '\\\\');
	// Depois escapa os demais caracteres especiais do MarkdownV2
	clean = clean.replace(/([_*\[\]()~`>#+\-=|{}\.!])/g, '\\$1');
	return clean;
}
import { env } from '@/config/env';
import { buildSessionKey, parseSessionKey as parseSessionKeyUtil } from '@/services/session-service';
import { loggers } from '@/utils/logger';
import { setAttributes, startSpan } from '@nexo/otel/tracing';
import type {
	ChatAction,
	ChatCommand,
	CommandParams,
	IncomingMessage,
	MessagingProvider,
	ProviderType,
	SessionKeyParams,
	SessionKeyParts,
} from './types';

/**
 * Adapter para Telegram Bot API com suporte a grupos e OpenClaw patterns
 */
export class TelegramAdapter implements MessagingProvider {
	private baseUrl = 'https://api.telegram.org';
	private token = env.TELEGRAM_BOT_TOKEN;
	private webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;
	private botUsername?: string;
	private commands: Map<string, ChatCommand> = new Map();

	constructor() {
		// Fetch bot info on init to get username
		this.getMe().then((me) => {
			this.botUsername = me.result?.username;
			loggers.webhook.info({ username: this.botUsername }, '🤖 Telegram bot initialized');
		});
	}

	getProviderName(): ProviderType {
		return 'telegram';
	}

	parseIncomingMessage(payload: any): IncomingMessage | null {
		const providerPayload = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;

		// Telegram Update pode ter message, edited_message ou callback_query
		const message = payload.message || payload.edited_message;
		const callbackQuery = payload.callback_query;

		// Se for callback query (inline button clicado)
		if (callbackQuery) {
			const chatId = callbackQuery.message?.chat?.id?.toString() || callbackQuery.from?.id?.toString();
			const senderName =
				[callbackQuery.from.first_name, callbackQuery.from.last_name].filter(Boolean).join(' ') || callbackQuery.from.username || 'Usuário';

			return {
				messageId: callbackQuery.id,
				externalId: chatId,
				userId: callbackQuery.from?.id?.toString(),
				senderName,
				username: callbackQuery.from?.username,
				text: callbackQuery.data || '', // callback_data vira o "texto"
				timestamp: new Date(),
				provider: 'telegram',
				callbackQueryId: callbackQuery.id,
				callbackData: callbackQuery.data,
				metadata: {
					isGroupMessage: callbackQuery.message?.chat?.type !== 'private',
					messageType: 'callback',
					providerPayload,
				},
			};
		}

		if (!message) {
			return null;
		}

		// Texto pode vir de text ou caption (fotos/vídeos/documentos)
		const text = message.text || message.caption;

		// Check if it's a command
		const isCommand = text?.startsWith('/');

		// Telegram usa chat.id como identificador único
		const chatId = message.chat.id.toString();
		const chatType = message.chat.type; // 'private', 'group', 'supergroup', 'channel'

		// Nome: fallback chain
		const senderName = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ') || message.from.username || 'Usuário';

		// Detect group and mention gating
		const isGroupMessage = chatType !== 'private';
		let botMentioned = false;

		// Check for bot mention in groups
		if (isGroupMessage && text && this.botUsername) {
			// Check if message contains @bot_username
			botMentioned = text.includes(`@${this.botUsername}`);

			// For commands without mention, check if it's directly addressed to bot
			if (isCommand && !botMentioned) {
				// Commands without @mention in groups should be ignored unless configured otherwise
				// This implements mention gating
				loggers.webhook.debug({ chatId, chatType, text: text.substring(0, 50) }, '⚠️ Command in group without mention - ignoring');
				return null; // Ignore messages in groups without mention
			}

			// For non-command text, also require mention
			if (!isCommand && !botMentioned) {
				loggers.webhook.debug({ chatId, chatType }, '⚠️ Message in group without mention - ignoring');
				return null;
			}
		}

		// Telefone: raramente disponível (apenas se usuário compartilhou contato)
		const phoneNumber = message.contact?.phone_number;

		// Detecta tokens de vinculação em comandos /start
		let linkingToken: string | undefined;
		if (text?.startsWith('/start ')) {
			linkingToken = text.split(' ')[1];
		}

		// Extract command name if present
		let messageType: 'text' | 'command' | 'callback' | 'unknown' = 'text';
		if (isCommand) {
			messageType = 'command';
		}

		return {
			messageId: message.message_id.toString(),
			externalId: chatId,
			userId: message.from?.id?.toString(),
			senderName,
			username: message.from?.username,
			text,
			timestamp: new Date(message.date * 1000),
			provider: 'telegram',
			phoneNumber,
			linkingToken,
			metadata: {
				isGroupMessage,
				groupId: isGroupMessage ? chatId : undefined,
				groupTitle: isGroupMessage ? message.chat.title : undefined,
				botMentioned,
				messageType,
				providerPayload,
			},
		};
	}

	verifyWebhook(request: any): boolean {
		// Telegram webhook secret (recomendado em produção)
		if (!this.webhookSecret) {
			loggers.webhook.warn('Telegram webhook sem secret_token configurado. Configure TELEGRAM_WEBHOOK_SECRET em produção.');
			return true; // Modo dev: aceita tudo
		}

		// Elysia/Fetch API usa Headers object com .get()
		// Express usa objeto plain com lowercase keys
		const headers = request.headers;
		const secretToken = headers?.get?.('x-telegram-bot-api-secret-token') || headers?.['x-telegram-bot-api-secret-token'];

		if (secretToken !== this.webhookSecret) {
			loggers.webhook.error({ secretToken: secretToken || '(nenhum)' }, 'Telegram webhook secret inválido ou ausente');
			return false;
		}

		return true;
	}

	async sendMessage(
		chatId: string,
		text: string,
		options?: {
			parseMode?: 'MarkdownV2' | 'HTML';
			replyToMessageId?: number;
		},
	): Promise<void> {
		return startSpan('messaging.telegram.send', async (_span) => {
			setAttributes({
				'messaging.platform': 'telegram',
				'messaging.chat_id': chatId,
				'messaging.message_length': text.length,
				'messaging.parse_mode': options?.parseMode || 'none',
			});

			const url = `${this.baseUrl}/bot${this.token}/sendMessage`;

			const payload: any = {
				chat_id: chatId,
				text,
			};

			// Parse mode opcional
			if (options?.parseMode) {
				payload.parse_mode = options.parseMode;
			}

			// Reply to message
			if (options?.replyToMessageId) {
				payload.reply_parameters = {
					message_id: options.replyToMessageId,
				};
			}

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorData = (await response.json()) as { error_code?: number; description?: string };
				loggers.webhook.error(
					{
						errorCode: errorData.error_code,
						description: errorData.description,
						chatId,
						textLength: text.length,
					},
					'Erro ao enviar mensagem Telegram',
				);
				throw new Error(`Telegram API error [${errorData.error_code}]: ${errorData.description}`);
			}

			loggers.webhook.info({ chatId }, 'Mensagem Telegram enviada');
		});
	}

	/**
	 * Envia mensagem com inline keyboard (botões clicáveis)
	 */
	async sendMessageWithButtons(
		chatId: string,
		text: string,
		buttons: Array<Array<{ text: string; callback_data?: string; url?: string }>>,
		options?: {
			parseMode?: 'MarkdownV2' | 'HTML';
		},
	): Promise<void> {
		return startSpan('messaging.telegram.send_with_buttons', async (_span) => {
			setAttributes({
				'messaging.platform': 'telegram',
				'messaging.chat_id': chatId,
				'messaging.message_length': text.length,
				'messaging.buttons_count': buttons.flat().length,
			});

			const url = `${this.baseUrl}/bot${this.token}/sendMessage`;

			const payload: any = {
				chat_id: chatId,
				text,
				reply_markup: {
					inline_keyboard: buttons,
				},
			};

			if (options?.parseMode) {
				payload.parse_mode = options.parseMode;
			}

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorData = (await response.json()) as { error_code?: number; description?: string };
				loggers.webhook.error(
					{
						errorCode: errorData.error_code,
						description: errorData.description,
					},
					'Erro ao enviar mensagem com botões',
				);
				throw new Error(`Telegram API error: ${errorData.description}`);
			}

			loggers.webhook.info({ chatId, buttonsCount: buttons.flat().length }, 'Mensagem com botões enviada');
		});
	}

	/**
	 * Envia foto com caption e botões
	 */
	async sendPhoto(
		chatId: string,
		photoUrl: string,
		caption?: string,
		buttons?: Array<Array<{ text: string; callback_data?: string; url?: string }>>,
		options?: {
			parseMode?: 'MarkdownV2' | 'HTML';
		},
	): Promise<void> {
		return startSpan('messaging.telegram.send_photo', async (_span) => {
			setAttributes({
				'messaging.platform': 'telegram',
				'messaging.chat_id': chatId,
				'messaging.has_caption': !!caption,
				'messaging.has_buttons': !!buttons,
				'messaging.buttons_count': buttons?.flat().length || 0,
			});

			const url = `${this.baseUrl}/bot${this.token}/sendPhoto`;

			const payload: any = {
				chat_id: chatId,
				photo: photoUrl,
				parse_mode: 'Markdown', // Habilita formatação no caption
			};

			if (caption) {
				let safeCaption = escapeMarkdownV2(caption);
				// Limita a 1024 caracteres
				if (safeCaption.length > 1024) {
					safeCaption = `${safeCaption.slice(0, 1020)}...`;
				}
				payload.caption = safeCaption;
				payload.parse_mode = 'MarkdownV2';
			}

			if (options?.parseMode) {
				payload.parse_mode = options.parseMode;
			}

			if (buttons) {
				payload.reply_markup = {
					inline_keyboard: buttons,
				};
			}

			loggers.webhook.info({ chatId, photoUrl, hasCaption: !!caption, hasButtons: !!buttons }, '📤 Enviando foto via Telegram');

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorData = (await response.json()) as { error_code?: number; description?: string };
				loggers.webhook.error({ errorCode: errorData.error_code }, 'Erro ao enviar foto');
				throw new Error(`Telegram API error: ${errorData.description}`);
			}

			loggers.webhook.info({ chatId }, 'Foto enviada');
		});
	}

	/**
	 * Responde a callback query (necessário para remover loading dos botões)
	 */
	async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
		const url = `${this.baseUrl}/bot${this.token}/answerCallbackQuery`;

		const payload: any = {
			callback_query_id: callbackQueryId,
		};

		if (text) {
			payload.text = text;
		}

		await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});
	}

	/**
	 * Envia indicador de atividade (typing, upload_photo, etc)
	 * Status dura 5 segundos ou até próxima mensagem
	 */
	async sendTypingIndicator(chatId: string): Promise<void> {
		await this.sendChatAction(chatId, 'typing');
	}

	async sendChatAction(chatId: string, action: ChatAction): Promise<void> {
		const url = `${this.baseUrl}/bot${this.token}/sendChatAction`;

		// Map generic action to Telegram-specific action
		const telegramActions: Record<ChatAction, string> = {
			typing: 'typing',
			upload_photo: 'upload_photo',
			upload_video: 'upload_video',
			upload_document: 'upload_document',
			find_location: 'find_location',
			record_video: 'record_video',
			record_audio: 'record_audio',
			record_video_note: 'record_video_note',
		};

		await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ chat_id: chatId, action: telegramActions[action] || action }),
		});
	}

	/**
	 * Constroi session key no formato OpenClaw
	 * Format: agent:{agentId}:{channel}:{peerKind}:{peerId}
	 */
	buildSessionKey(params: SessionKeyParams): string {
		return buildSessionKey(params);
	}

	/**
	 * Parse session key em componentes
	 */
	parseSessionKey(key: string): SessionKeyParts {
		return parseSessionKeyUtil(key);
	}

	/**
	 * Registra comando de chat
	 */
	registerCommand(command: ChatCommand): void {
		this.commands.set(command.name, command);
		if (command.aliases) {
			for (const alias of command.aliases) {
				this.commands.set(alias, command);
			}
		}
		loggers.webhook.info({ name: command.name, aliases: command.aliases }, '✅ Command registered');
	}

	/**
	 * Executa comando de chat
	 */
	async handleCommand(command: string, params: CommandParams): Promise<void> {
		const cmd = this.commands.get(command);
		if (!cmd) {
			loggers.webhook.warn({ command }, '⚠️ Unknown command');
			return;
		}

		// Check if command is allowed in groups
		const isGroup = params.sessionKey.includes(':group:');
		if (isGroup && !cmd.allowedInGroups) {
			loggers.webhook.warn({ command }, '⚠️ Command not allowed in groups');
			return;
		}

		try {
			const response = await cmd.handler(params);
			if (response) {
				// Extract chat ID from session key
				const parts = this.parseSessionKey(params.sessionKey);
				const peerId = parts.peerId;
				await this.sendMessage(peerId, response);
			}
		} catch (error) {
			loggers.webhook.error({ error, command }, '❌ Command execution failed');
		}
	}

	/**
	 * Marca mensagem como lida (via Telegram read receipt)
	 */
	async markAsRead(messageId: string): Promise<void> {
		// Telegram doesn't have a native "read receipt" feature like WhatsApp
		// This is a no-op for Telegram
		loggers.webhook.debug({ messageId }, '📭 Mark as read (no-op for Telegram)');
	}

	/**
	 * Define webhook do Telegram (usar em setup inicial)
	 */
	async setWebhook(webhookUrl: string): Promise<void> {
		const url = `${this.baseUrl}/bot${this.token}/setWebhook`;

		const payload = {
			url: webhookUrl,
			secret_token: this.webhookSecret,
			allowed_updates: ['message', 'edited_message', 'callback_query'],
		};

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const errorData = (await response.json()) as { error_code?: number; description?: string };
			throw new Error(`Telegram setWebhook error [${errorData.error_code}]: ${errorData.description}`);
		}
	}

	/**
	 * Valida token do bot (útil para health checks)
	 */
	async getMe(): Promise<any> {
		const url = `${this.baseUrl}/bot${this.token}/getMe`;
		const response = await fetch(url);

		if (!response.ok) {
			const errorData = (await response.json()) as { error_code?: number; description?: string };
			throw new Error(`Telegram getMe error [${errorData.error_code}]: ${errorData.description}`);
		}

		return response.json();
	}
}

export const telegramAdapter = new TelegramAdapter();
