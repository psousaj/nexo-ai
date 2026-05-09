import type { KernelCallbacks } from '@/core/kernel/hermes-kernel';
import { resolveSessionKey } from '@/core/registries/session-registry';
import { createHermesRuntime } from '@/core/runtime/hermes-runtime';
import type { Hono } from 'hono';
import {
	answerCallbackQuery,
	editMessageText,
	extractTelegramMessage,
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
					await editMessageText(chatId, messageId, `*Você escolheu:* ${choice}`);
					if (cb.id) await answerCallbackQuery(cb.id);
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
				if (cb.id) await answerCallbackQuery(cb.id);
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

			try {
				const systemPrompt = runtime.contextAssembler.buildFromSessionKey(sessionKey);
				const callbacks: KernelCallbacks = {
					onToolStart: (toolName, _input) => {
						const text = `🔍 *${toolName}*...`;
						if (progressMessageId) {
							editMessageText(msg.chatId, progressMessageId, text).catch(() => {});
						} else {
							sendProgressMessage(msg.chatId, text)
								.then((id) => {
									progressMessageId = id;
								})
								.catch(() => {});
						}
					},
					onToolEnd: (toolName, _result) => {
						const text = `✅ *${toolName}* concluído`;
						if (progressMessageId) {
							editMessageText(msg.chatId, progressMessageId, text).catch(() => {});
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
