import { resolveSessionKey } from '@/core/registries/session-registry';
import { createHermesRuntime } from '@/core/runtime/hermes-runtime';
import type { Hono } from 'hono';
import {
	extractTelegramMessage,
	sendTelegramMessage,
	telegramUpdateToEnvelope,
} from '../../channels/telegram/dispatcher';

const runtime = createHermesRuntime();

export function registerTelegramWebhook(app: Hono) {
	app.post('/webhook/telegram', async (c) => {
		try {
			const update = await c.req.json();
			const envelope = telegramUpdateToEnvelope(update);
			if (!envelope) return c.json({ ok: true });

			const sessionKey = resolveSessionKey('telegram', envelope.payload.incomingMsg.externalId);
			const msg = extractTelegramMessage(envelope);

			const result = await runtime.kernel.runTurn({ sessionKey });

			await sendTelegramMessage(msg.chatId, result.text);
			return c.json({ ok: true, sessionKey });
		} catch (error) {
			console.error('Telegram webhook error:', error);
			return c.json({ ok: false, error: 'Internal error' }, 500);
		}
	});
}
