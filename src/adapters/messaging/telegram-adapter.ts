import { env } from '@/config/env';
import { loggers } from '@/utils/logger';
import type { MessagingProvider, IncomingMessage, ProviderType } from './types';

/**
 * Adapter para Telegram Bot API
 */
export class TelegramAdapter implements MessagingProvider {
	private baseUrl = 'https://api.telegram.org';
	private token = env.TELEGRAM_BOT_TOKEN;
	private webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;

	getProviderName(): ProviderType {
		return 'telegram';
	}

	parseIncomingMessage(payload: any): IncomingMessage | null {
		// Telegram Update pode ter message, edited_message ou callback_query
		const message = payload.message || payload.edited_message;
		const callbackQuery = payload.callback_query;

		// Se for callback query (inline button clicado)
		if (callbackQuery) {
			const chatId = callbackQuery.message?.chat?.id?.toString() || callbackQuery.from?.id?.toString();
			const senderName = [callbackQuery.from.first_name, callbackQuery.from.last_name].filter(Boolean).join(' ') || callbackQuery.from.username || 'Usuário';

			return {
				messageId: callbackQuery.id,
				externalId: chatId,
				senderName,
				text: callbackQuery.data || '', // callback_data vira o "texto"
				timestamp: new Date(),
				provider: 'telegram',
				callbackQueryId: callbackQuery.id,
				callbackData: callbackQuery.data,
			};
		}

		if (!message) {
			return null;
		}

		// Texto pode vir de text ou caption (fotos/vídeos/documentos)
		const text = message.text || message.caption;

		if (!text) {
			return null; // Ignora se não houver texto
		}

		// Telegram usa chat.id como identificador único
		const chatId = message.chat.id.toString();

		// Nome: fallback chain
		const senderName = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ') || message.from.username || 'Usuário';

		// Telefone: raramente disponível (apenas se usuário compartilhou contato)
		const phoneNumber = message.contact?.phone_number;

		return {
			messageId: message.message_id.toString(),
			externalId: chatId,
			senderName,
			text,
			timestamp: new Date(message.date * 1000),
			provider: 'telegram',
			phoneNumber,
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
		const secretToken =
			headers?.get?.('x-telegram-bot-api-secret-token') || // Fetch API (case-insensitive)
			headers?.['x-telegram-bot-api-secret-token']; // Express-style

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
		}
	): Promise<void> {
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
				'Erro ao enviar mensagem Telegram'
			);
			throw new Error(`Telegram API error [${errorData.error_code}]: ${errorData.description}`);
		}

		loggers.webhook.info({ chatId }, 'Mensagem Telegram enviada');
	}

	/**
	 * Envia mensagem com inline keyboard (botões clicáveis)
	 */
	async sendMessageWithButtons(
		chatId: string,
		text: string,
		buttons: Array<Array<{ text: string; callback_data: string }>>,
		options?: {
			parseMode?: 'MarkdownV2' | 'HTML';
		}
	): Promise<void> {
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
				'Erro ao enviar mensagem com botões'
			);
			throw new Error(`Telegram API error: ${errorData.description}`);
		}

		loggers.webhook.info({ chatId, buttonsCount: buttons.flat().length }, 'Mensagem com botões enviada');
	}

	/**
	 * Envia foto com caption e botões
	 */
	async sendPhoto(
		chatId: string,
		photoUrl: string,
		caption?: string,
		buttons?: Array<Array<{ text: string; callback_data: string }>>,
		options?: {
			parseMode?: 'MarkdownV2' | 'HTML';
		}
	): Promise<void> {
		const url = `${this.baseUrl}/bot${this.token}/sendPhoto`;

		const payload: any = {
			chat_id: chatId,
			photo: photoUrl,
		};

		if (caption) {
			payload.caption = caption;
		}

		if (options?.parseMode) {
			payload.parse_mode = options.parseMode;
		}

		if (buttons) {
			payload.reply_markup = {
				inline_keyboard: buttons,
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
			loggers.webhook.error({ errorCode: errorData.error_code }, 'Erro ao enviar foto');
			throw new Error(`Telegram API error: ${errorData.description}`);
		}

		loggers.webhook.info({ chatId }, 'Foto enviada');
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
