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

export async function sendTelegramMessage(chatId: number, text: string, options?: { replyMarkup?: unknown }): Promise<void> {
	const params: Record<string, unknown> = { parse_mode: 'Markdown' };
	if (options?.replyMarkup) params.reply_markup = options.replyMarkup;
	await getBot().api.sendMessage(chatId, text, params as any);
}

export async function sendClarifyMessage(chatId: number, question: string, choices?: string[]): Promise<void> {
	if (choices && choices.length > 0) {
		const keyboard = {
			inline_keyboard: choices.map((c) => [{ text: c, callback_data: `clarify:${c}` }]),
		};
		await sendTelegramMessage(chatId, question, { replyMarkup: keyboard });
		return;
	}
	await sendTelegramMessage(chatId, question);
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
