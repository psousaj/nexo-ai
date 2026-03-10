import { telegramAdapter, whatsappAdapter } from '@nexo/api-core/adapters/messaging';
import { env } from '@nexo/api-core/config/env';
import { messageQueue } from '@nexo/api-core/services/queue-service';
import { logError, loggers } from '@nexo/api-core/utils/logger';
import { setAttributes, startSpan } from '@nexo/otel/tracing';
import Elysia from 'elysia';

export const webhookRouter = new Elysia({ prefix: '/webhook' })
	// =========================================================================
	// TELEGRAM
	// =========================================================================
	.post('/telegram', async ({ request, set }) => {
		return startSpan('webhook.telegram.receive', async (_span: any) => {
			setAttributes({ 'webhook.provider': 'telegram', 'webhook.route': '/telegram' });
			loggers.webhook.info('🔹 Telegram recebido');

			if (!env.TELEGRAM_BOT_TOKEN) {
				setAttributes({ 'webhook.status': 'not_configured' });
				set.status = 500;
				return { error: 'Telegram not configured' };
			}

			const isTelegramValid = telegramAdapter.verifyWebhook(request);
			if (!isTelegramValid) {
				setAttributes({ 'webhook.status': 'unauthorized' });
				set.status = 401;
				return { error: 'Unauthorized' };
			}

			try {
				const body = await request.json();
				loggers.webhook.debug({ body }, '📦 Raw Telegram body');

				const message = telegramAdapter.parseIncomingMessage(body);

				if (message) {
					setAttributes({
						'message.external_id': message.externalId,
						'message.has_callback': !!message.callbackQueryId,
						'message.text_length': message.text?.length || 0,
					});

					if (message.callbackQueryId) {
						await telegramAdapter.answerCallbackQuery(message.callbackQueryId);
					}

					await messageQueue.add(
						'message-processing',
						{ incomingMsg: message, providerName: 'telegram' },
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

				return { ok: true };
			} catch (err) {
				setAttributes({ 'webhook.status': 'error' });
				logError(err, { context: 'WEBHOOK', provider: 'telegram' });
				set.status = 500;
				return { ok: false };
			}
		});
	})

	// =========================================================================
	// WHATSAPP VERIFICATION
	// =========================================================================
	.get('/meta', ({ query, set }) => {
		setAttributes({ 'webhook.provider': 'whatsapp', 'webhook.type': 'verification' });

		const mode = query['hub.mode'];
		const token = query['hub.verify_token'];
		const challenge = query['hub.challenge'];

		if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
			setAttributes({ 'webhook.status': 'verified' });
			loggers.webhook.info('✅ Webhook WhatsApp verificado');
			return new Response(challenge);
		}

		setAttributes({ 'webhook.status': 'verification_failed' });
		set.status = 403;
		return 'Verification failed';
	})

	// =========================================================================
	// WHATSAPP MESSAGES
	// =========================================================================
	.post('/meta', async ({ request, set }) => {
		return startSpan('webhook.whatsapp.receive', async (_span: any) => {
			setAttributes({ 'webhook.provider': 'whatsapp', 'webhook.route': '/meta' });

			if (!whatsappAdapter) {
				setAttributes({ 'webhook.status': 'not_configured' });
				set.status = 500;
				return { error: 'WhatsApp not configured' };
			}

			const rawBody = await request.text();
			const isWhatsAppValid = await whatsappAdapter.verifyWebhook({
				headers: request.headers,
				body: rawBody,
			});
			if (!isWhatsAppValid) {
				setAttributes({ 'webhook.status': 'unauthorized' });
				set.status = 401;
				return { error: 'Unauthorized' };
			}

			try {
				const body = JSON.parse(rawBody);
				const message = whatsappAdapter.parseIncomingMessage(body);

				if (message) {
					setAttributes({
						'message.external_id': message.externalId,
						'message.text_length': message.text?.length || 0,
					});

					await messageQueue.add(
						'message-processing',
						{ incomingMsg: message, providerName: 'whatsapp', providerApi: 'meta' },
						{
							removeOnComplete: true,
							attempts: 3,
							backoff: { type: 'exponential', delay: 2000 },
						},
					);

					setAttributes({ 'webhook.status': 'queued' });
					loggers.webhook.info({ externalId: message.externalId }, '📥 Mensagem enfileirada (WhatsApp)');
				}

				return { status: 'ok' };
			} catch (err) {
				setAttributes({ 'webhook.status': 'error' });
				logError(err, { context: 'WEBHOOK', provider: 'whatsapp' });
				set.status = 500;
				return { status: 'error' };
			}
		});
	});
