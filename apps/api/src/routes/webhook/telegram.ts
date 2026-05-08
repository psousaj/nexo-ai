import { resolveSessionKey } from '@/core/registries/session-registry';
import type { Hono } from 'hono';
import { telegramUpdateToEnvelope, sendTelegramMessage, extractTelegramMessage } from '../../channels/telegram/dispatcher';

export function registerTelegramWebhook(app: Hono) {
	app.post('/webhook/telegram', async (c) => {
		try {
			const update = await c.req.json();
			const envelope = telegramUpdateToEnvelope(update);
			if (!envelope) return c.json({ ok: true });

			const sessionKey = resolveSessionKey('telegram', envelope.payload.incomingMsg.externalId);
			const msg = extractTelegramMessage(envelope);
			await sendTelegramMessage(msg.chatId, `*Echo:* ${msg.text || 'Recebi!'}`);

			return c.json({ ok: true, sessionKey });
		} catch (error) {
			console.error('Telegram webhook error:', error);
			return c.json({ ok: false, error: 'Internal error' }, 500);
		}
	});
}
