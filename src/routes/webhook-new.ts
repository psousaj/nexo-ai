import { Hono } from 'hono';
import { whatsappAdapter, telegramAdapter } from '@/adapters/messaging';
import { env } from '@/config/env';
import { loggers, logError } from '@/utils/logger';
import { messageQueue } from '@/services/queue-service';
import { accountLinkingService } from '@/services/account-linking-service';

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

				// VERIFICA VINCULAÇÃO DE CONTA (DEEP LINKING)
				if (message.linkingToken) {
					loggers.webhook.info({ token: message.linkingToken }, '🔗 Processando token de vinculação Telegram');
					const linked = await accountLinkingService.linkAccountByToken(message.linkingToken, message.externalId, {
						username: message.senderName,
					});

					if (linked) {
						await telegramAdapter.sendMessage(
							message.externalId,
							'✅ Sua conta foi vinculada com sucesso ao seu painel Nexo AI!\n\nO que você quer salvar hoje?',
						);
						return c.json({ ok: true });
					} else {
						await telegramAdapter.sendMessage(
							message.externalId,
							'❌ Token de vinculação inválido ou expirado. Tente gerar um novo link no painel.',
						);
						return c.json({ ok: true });
					}
				}

				// TRATA /START SEM TOKEN (DESCOBERTA FORA DO DASHBOARD)
				if (message.text === '/start') {
					const dashboardUrl = `${env.APP_URL.replace(':3000', ':5173')}/profile`;
					await telegramAdapter.sendMessage(
						message.externalId,
						`Olá! 😊\n\nSou o Nexo AI. Se você já utiliza nosso serviço pelo WhatsApp e quer vincular sua conta para usar por aqui também, acesse o seu painel de controle:\n\n🔗 ${dashboardUrl}\n\nSe você é novo por aqui, basta me enviar qualquer mensagem e eu começarei a te ajudar a organizar seu dia!`,
					);
					return c.json({ ok: true });
				}

				// Enfileira processamento assíncrono para mensagens normais
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
					},
				);

				loggers.webhook.info({ externalId: message.externalId }, '📥 Mensagem enfileirada (WhatsApp)');
			}

			return c.json({ status: 'ok' });
		} catch (error) {
			logError(error, { context: 'WEBHOOK', provider: 'whatsapp' });
			return c.json({ status: 'error' }, 500);
		}
	});
