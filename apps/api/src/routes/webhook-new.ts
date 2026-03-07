import { telegramAdapter, whatsappAdapter } from '@/adapters/messaging';
import { env } from '@/config/env';
import { messageQueue } from '@/services/queue-service';
import { logError, loggers } from '@/utils/logger';
import { setAttributes, startSpan } from '@nexo/otel/tracing';
import { Hono } from 'hono';

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

	// WHATSAPP
	.get('/meta', (c) => {
		const query = c.req.query();
		const mode = query['hub.mode'];
		const token = query['hub.verify_token'];
		const challenge = query['hub.challenge'];

		setAttributes({
			'webhook.provider': 'whatsapp',
			'webhook.type': 'verification',
		});

		if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
			setAttributes({ 'webhook.status': 'verified' });
			loggers.webhook.info('✅ Webhook WhatsApp verificado');
			return c.text(challenge);
		}

		setAttributes({ 'webhook.status': 'verification_failed' });
		return c.text('Verification failed', 403);
	})
	.post('/meta', async (c) => {
		return startSpan('webhook.whatsapp.receive', async (_span) => {
			setAttributes({
				'webhook.provider': 'whatsapp',
				'webhook.route': '/meta',
			});

			if (!whatsappAdapter) {
				setAttributes({ 'webhook.status': 'not_configured' });
				return c.json({ error: 'WhatsApp not configured' }, 500);
			}

			// Valida assinatura HMAC SHA-256 do Meta antes de processar
			const rawBody = await c.req.text();
			const isWhatsAppValid = await whatsappAdapter.verifyWebhook({
				headers: c.req.raw.headers,
				body: rawBody,
			});
			if (!isWhatsAppValid) {
				setAttributes({ 'webhook.status': 'unauthorized' });
				return c.json({ error: 'Unauthorized' }, 401);
			}

			try {
				const body = JSON.parse(rawBody);
				const message = whatsappAdapter.parseIncomingMessage(body);

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
							providerApi: 'meta',
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
