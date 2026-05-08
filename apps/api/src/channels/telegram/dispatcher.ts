import type { Update } from 'grammy';
import type { CanonicalMessageEnvelope, IngestMessageQueuePayload } from '@/core/gateway/ingestion-gateway';
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

export async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
	await getBot().api.sendMessage(chatId, text, { parse_mode: 'Markdown' });
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
