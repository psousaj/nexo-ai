import type { KernelCallbacks } from '@/core/kernel/hermes-kernel';
import { resolveSessionKey } from '@/core/registries/session-registry';
import { createHermesRuntime } from '@/core/runtime/hermes-runtime';
import type { Hono } from 'hono';
import { getBot } from '../../channels/telegram/bot';
import {
	extractTelegramMessage,
	sendClarifyMessage,
	sendProgressMessage,
	sendTelegramMessage,
	sendTelegramPhoto,
	sendTypingAction,
	setMessageReaction,
	telegramUpdateToEnvelope,
} from '../../channels/telegram/dispatcher';

const runtime = createHermesRuntime();

export function registerTelegramWebhook(app: Hono) {
	app.post('/webhook/telegram', async (c) => {
		try {
			const update = await c.req.json();

			// Handle callback queries from inline keyboards (clarify responses)
			if (update.callback_query) {
				const cb = update.callback_query;
				const data = cb.data as string | undefined;
				const chatId = cb.message?.chat?.id;
				const messageId = cb.message?.message_id;
				if (data?.startsWith('clarify:') && chatId && messageId) {
					const choice = decodeURIComponent(data.slice('clarify:'.length));
					try {
						await getBot().api.editMessageText(chatId, messageId, `*Você escolheu:* ${choice}`, {
							parse_mode: 'Markdown',
							reply_markup: undefined,
						});
					} catch {}
					if (cb.id) await getBot().api.answerCallbackQuery(cb.id);
					const sessionKey = resolveSessionKey('telegram', String(chatId));
					const systemPrompt = await runtime.contextAssembler.buildFromSessionKey(sessionKey);
					const result = await runtime.kernel.runTurn({
						sessionKey,
						userMessage: choice,
						systemPrompt: systemPrompt.systemPrompt,
					});
					await sendTelegramMessage(chatId, result.text);
					return c.json({ ok: true });
				}
				if (cb.id) await getBot().api.answerCallbackQuery(cb.id);
				return c.json({ ok: true });
			}

			const envelope = telegramUpdateToEnvelope(update);
			if (!envelope) return c.json({ ok: true });

			const sessionKey = resolveSessionKey('telegram', envelope.payload.incomingMsg.externalId);
			const msg = extractTelegramMessage(envelope);
			const userMessageId = msg.messageId;

			// 👀 1. Reaction: "tô vendo sua mensagem"
			await setMessageReaction(msg.chatId, userMessageId, '👀');

			// 2. Start typing indicator (runs in background)
			const typingInterval = setInterval(() => {
				sendTypingAction(msg.chatId).catch(() => {});
			}, 4000);

			let progressMessageId: number | null = null;
			let progressText = '';

			try {
				const systemPrompt = await runtime.contextAssembler.buildFromSessionKey(sessionKey);
				const callbacks: KernelCallbacks = {
					onToolStart: (toolName, input) => {
						if (toolName === 'display_content') {
							const data = input as any;
							if (data?.imageUrl) {
								const caption = `*${data.title || ''}*\n\n${data.description || ''}`;
								sendTelegramPhoto(msg.chatId, data.imageUrl, caption).catch(() => {});
							}
							return;
						}
						if (toolName === 'clarify') {
							const data = input as any;
							sendClarifyMessage(msg.chatId, data.question || '', data.choices || []).catch(() => {});
							return;
						}
						progressText += `🔍 *${toolName}*...\n`;
						if (progressMessageId) {
							editMessageText(msg.chatId, progressMessageId, progressText).catch(() => {});
						} else {
							sendProgressMessage(msg.chatId, progressText)
								.then((id) => { progressMessageId = id; })
								.catch(() => {});
						}
					},
					onToolEnd: (toolName, _result) => {
						if (toolName === 'display_content' || toolName === 'clarify') return;
						progressText = progressText.replace(`🔍 *${toolName}*...\n`, `✅ *${toolName}* concluído\n`);
						if (progressMessageId) {
							editMessageText(msg.chatId, progressMessageId, progressText).catch(() => {});
						}
					},
				};

				const result = await runtime.kernel.runTurn(
					{ sessionKey, userMessage: msg.text, systemPrompt: systemPrompt.systemPrompt },
					callbacks,
				);

				// 👍 3. Reaction: deu certo
				await setMessageReaction(msg.chatId, userMessageId, '👍');

				// 4. Send final response
				await sendTelegramMessage(msg.chatId, result.text);
			} finally {
				clearInterval(typingInterval);
			}

			return c.json({ ok: true, sessionKey });
		} catch (error) {
			console.error('Telegram webhook error:', error);
			return c.json({ ok: false, error: 'Internal error' }, 500);
		}
	});
}
