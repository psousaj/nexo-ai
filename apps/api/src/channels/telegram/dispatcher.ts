import type { CanonicalMessageEnvelope, IngestMessageQueuePayload } from '@/core/gateway/ingestion-gateway';
import type { Update } from 'grammy';
import { getBot } from './bot';
import type { TelegramMessage } from './types';

export function telegramUpdateToEnvelope(update: Update): CanonicalMessageEnvelope<IngestMessageQueuePayload> | null {
	const msg = update.message;
	if (!msg?.text && !msg?.voice && !msg?.photo) return null;

	const chatId = msg.chat.id.toString();
	const text = msg.text ?? '';
	const messageType = msg.voice ? 'audio' : msg.photo ? 'image' : 'text';

	return {
		channel: 'telegram',
		eventId: `tg-${update.update_id}`,
		idempotencyKey: `tg-${msg.chat.id}-${msg.message_id}`,
		occurredAt: new Date().toISOString(),
		payload: {
			providerName: 'telegram',
			incomingMsg: {
				messageId: msg.message_id.toString(),
				externalId: chatId,
				text,
				timestamp: new Date(msg.date * 1000),
				provider: 'telegram',
				metadata: {
					isGroupMessage: msg.chat.type !== 'private',
					messageType,
				},
			},
		},
	};
}

export async function sendTelegramMessage(
	chatId: number,
	text: string,
	options?: { replyMarkup?: unknown },
): Promise<{ messageId: number } | void> {
	const params: Record<string, unknown> = { parse_mode: 'Markdown' };
	if (options?.replyMarkup) params.reply_markup = options.replyMarkup;
	const msg = await getBot().api.sendMessage(chatId, text, params as any);
	return { messageId: msg.message_id };
}

export async function editMessageText(chatId: number, messageId: number, text: string): Promise<void> {
	try {
		await getBot().api.editMessageText(chatId, messageId, text, { parse_mode: 'Markdown' });
	} catch {
		// Flood control or message unchanged — ignore
	}
}

export async function setMessageReaction(chatId: number, messageId: number, emoji: string): Promise<void> {
	try {
		await getBot().api.setMessageReaction(chatId, messageId, { reaction: [{ type: 'emoji', emoji }] });
	} catch {
		// Old API version may not support reactions
	}
}

export async function sendTypingAction(chatId: number): Promise<void> {
	try {
		await getBot().api.sendChatAction(chatId, 'typing');
	} catch {
		// Ignore
	}
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
	try {
		await getBot().api.answerCallbackQuery(callbackQueryId, { text });
	} catch {
		// Ignore
	}
}

export type ProgressCallback = (phase: 'tool_start' | 'tool_end' | 'stream_delta', data: { text: string; toolName?: string }) => void;

export async function sendProgressMessage(chatId: number, text: string): Promise<number> {
	const msg = await getBot().api.sendMessage(chatId, text, { parse_mode: 'Markdown' });
	return msg.message_id;
}

export async function sendClarifyMessage(chatId: number, question: string, choices?: string[]): Promise<number> {
	if (choices && choices.length > 0) {
		const keyboard = {
			inline_keyboard: choices.map((c) => [{ text: c, callback_data: `clarify:${c}` }]),
		};
		const msg = await getBot().api.sendMessage(chatId, question, { parse_mode: 'Markdown', reply_markup: keyboard });
		return msg.message_id;
	}
	const msg = await getBot().api.sendMessage(chatId, question, { parse_mode: 'Markdown' });
	return msg.message_id;
}

export function extractTelegramMessage(msg: CanonicalMessageEnvelope<IngestMessageQueuePayload>): TelegramMessage {
	const incoming = msg.payload.incomingMsg;
	return {
		chatId: Number(incoming.externalId),
		text: incoming.text,
		messageId: Number(incoming.messageId),
		timestamp: incoming.timestamp,
		messageType: (incoming.metadata?.messageType as TelegramMessage['messageType']) ?? 'text',
	};
}
