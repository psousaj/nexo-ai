import { evolutionAdapter, telegramAdapter } from '@nexo/api-core/adapters/messaging';
import { env } from '@nexo/api-core/config/env';
import { messageQueue } from '@nexo/api-core/services/queue-service';
import { logError, loggers } from '@nexo/api-core/utils/logger';
import { setAttributes, startSpan } from '@nexo/otel/tracing';
import { Hono } from 'hono';

const evolutionWebhookRoute = (() => {
	const rawPath = env.EVOLUTION_WEBHOOK_PATH || '/webhook/whatsapp/evolution';
	if (rawPath.startsWith('/webhook/')) {
		return rawPath.slice('/webhook'.length);
	}
	if (rawPath.startsWith('/')) {
		return rawPath;
	}
	return `/${rawPath}`;
})();

export const webhookRoutes = new Hono()
	// TELEGRAM
	.post('/telegram', async (c) => {
		return startSpan('webhook.telegram.receive', async (_span) => {
			setAttributes({
				'webhook.provider': 'telegram',
				'webhook.route': '/telegram',
			});

			loggers.webhook.info('🔹 Telegram recebido');

			if (!env.TELEGRAM_BOT_TOKEN) {
				setAttributes({ 'webhook.status': 'not_configured' });
				return c.json({ error: 'Telegram not configured' }, 500);
			}

			// Valida autenticidade do webhook antes de processar
			const isTelegramValid = telegramAdapter.verifyWebhook(c.req.raw);
			if (!isTelegramValid) {
				setAttributes({ 'webhook.status': 'unauthorized' });
				return c.json({ error: 'Unauthorized' }, 401);
			}

			try {
				const body = await c.req.json();
				loggers.webhook.debug({ body }, '📦 Raw Telegram body');

				const message = telegramAdapter.parseIncomingMessage(body);

				if (message) {
					setAttributes({
						'message.external_id': message.externalId,
						'message.has_callback': !!message.callbackQueryId,
						'message.text_length': message.text?.length || 0,
					});

					// Se for callback query, responde imediatamente
					if (message.callbackQueryId) {
						await telegramAdapter.answerCallbackQuery(message.callbackQueryId);
					}

					// Enfileira processamento assíncrono para todas as mensagens (incluindo comandos e tokens)
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
						},
					);

					setAttributes({ 'webhook.status': 'queued' });
					loggers.webhook.info({ externalId: message.externalId }, '📥 Mensagem enfileirada (Telegram)');
				} else {
					setAttributes({ 'webhook.status': 'ignored' });
					loggers.webhook.warn({ body }, '⚠️ Telegram message ignored (parsed as null)');
				}

				return c.json({ ok: true });
			} catch (error) {
				setAttributes({ 'webhook.status': 'error' });
				logError(error, { context: 'WEBHOOK', provider: 'telegram' });
				return c.json({ ok: false }, 500);
			}
		});
	})

	// WHATSAPP (Evolution)
	.get('/meta', (c) => {
		return c.json(
			{
				error: 'Legacy Meta webhook desativado. Configure Evolution em /webhook/whatsapp/evolution.',
			},
			410,
		);
	})
	.post('/meta', (c) => {
		return c.json(
			{
				error: 'Legacy Meta webhook desativado. Configure Evolution em /webhook/whatsapp/evolution.',
			},
			410,
		);
	})
	.post(evolutionWebhookRoute, async (c) => {
		return startSpan('webhook.whatsapp.receive', async (_span) => {
			setAttributes({
				'webhook.provider': 'whatsapp',
				'webhook.route': evolutionWebhookRoute,
			});

			if (!env.EVOLUTION_WEBHOOK_SECRET) {
				setAttributes({ 'webhook.status': 'not_configured' });
				return c.json({ error: 'Evolution webhook secret not configured' }, 500);
			}

			const isWhatsAppValid = evolutionAdapter.verifyWebhook(c.req.raw);
			if (!isWhatsAppValid) {
				setAttributes({ 'webhook.status': 'unauthorized' });
				return c.json({ error: 'Unauthorized' }, 401);
			}

			try {
				const body = await c.req.json();
				const message = evolutionAdapter.parseIncomingMessage(body);

				if (message) {
					setAttributes({
						'message.external_id': message.externalId,
						'message.text_length': message.text?.length || 0,
					});

					// Enfileira processamento assíncrono
					await messageQueue.add(
						'message-processing',
						{
							incomingMsg: message,
							providerName: 'whatsapp',
							providerApi: 'evolution',
						},
						{
							removeOnComplete: true,
							attempts: 3,
							backoff: { type: 'exponential', delay: 2000 },
						},
					);

					setAttributes({ 'webhook.status': 'queued' });
					loggers.webhook.info({ externalId: message.externalId }, '📥 Mensagem enfileirada (WhatsApp)');
				}

				return c.json({ status: 'ok' });
			} catch (error) {
				setAttributes({ 'webhook.status': 'error' });
				logError(error, { context: 'WEBHOOK', provider: 'whatsapp' });
				return c.json({ status: 'error' }, 500);
			}
		});
	});
