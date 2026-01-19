import { Hono } from 'hono';
import { whatsappAdapter, telegramAdapter } from '@/adapters/messaging';
import { env } from '@/config/env';
import { loggers, logError } from '@/utils/logger';
import { messageQueue } from '@/services/queue-service';

export const webhookRoutes = new Hono()
	// TELEGRAM
	.post('/telegram', async (c) => {
		loggers.webhook.info('🔹 Telegram recebido');

		if (!env.TELEGRAM_BOT_TOKEN) {
			return c.json({ error: 'Telegram not configured' }, 500);
		}

		try {
			const body = await c.req.json();
			loggers.webhook.debug({ body }, '📦 Raw Telegram body');

			const message = telegramAdapter.parseIncomingMessage(body);

			if (message) {
				// Se for callback query, responde imediatamente
				if (message.callbackQueryId) {
					await telegramAdapter.answerCallbackQuery(message.callbackQueryId);
				}

				// Enfileira processamento assíncrono
				await messageQueue.add(
					'message-processing',
					{
						incomingMsg: message,
						providerName: 'telegram',
					},
					{
						removeOnComplete: true,
						attempts: 3,
						backoff: { type: 'exponential', delay: 2000 },
					}
				);

				loggers.webhook.info({ externalId: message.externalId }, '📥 Mensagem enfileirada (Telegram)');
			} else {
				loggers.webhook.warn({ body }, '⚠️ Telegram message ignored (parsed as null)');
			}

			return c.json({ ok: true });
		} catch (error) {
			logError(error, { context: 'WEBHOOK', provider: 'telegram' });
			return c.json({ ok: false }, 500);
		}
	})

	// WHATSAPP
	.get('/meta', (c) => {
		const query = c.req.query();
		const mode = query['hub.mode'];
		const token = query['hub.verify_token'];
		const challenge = query['hub.challenge'];

		if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
			loggers.webhook.info('✅ Webhook WhatsApp verificado');
			return c.text(challenge);
		}

		return c.text('Verification failed', 403);
	})
	.post('/meta', async (c) => {
		if (!whatsappAdapter) {
			return c.json({ error: 'WhatsApp not configured' }, 500);
		}

		try {
			const body = await c.req.json();
			const message = whatsappAdapter.parseIncomingMessage(body);

			if (message) {
				// Enfileira processamento assíncrono
				await messageQueue.add(
					'message-processing',
					{
						incomingMsg: message,
						providerName: 'whatsapp',
					},
					{
						removeOnComplete: true,
						attempts: 3,
						backoff: { type: 'exponential', delay: 2000 },
					}
				);

				loggers.webhook.info({ externalId: message.externalId }, '📥 Mensagem enfileirada (WhatsApp)');
			}

			return c.json({ status: 'ok' });
		} catch (error) {
			logError(error, { context: 'WEBHOOK', provider: 'whatsapp' });
			return c.json({ status: 'error' }, 500);
		}
	});
