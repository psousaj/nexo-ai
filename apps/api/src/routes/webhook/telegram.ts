import type { KernelCallbacks } from '@/core/kernel/hermes-kernel';
import { resolveSessionKey } from '@/core/registries/session-registry';
import { createHermesRuntime } from '@/core/runtime/hermes-runtime';
import type { Hono } from 'hono';
import { getBot } from '../../channels/telegram/bot';
import {
	editMessageText,
	extractTelegramMessage,
	sendClarifyMessage,
	sendProgressMessage,
	sendTelegramMessage,
	sendTypingAction,
	setMessageReaction,
	telegramUpdateToEnvelope,
} from '../../channels/telegram/dispatcher';

const runtime = createHermesRuntime();
const lastClarifyContext = new Map<number, { question: string; choices: string[] }>();

async function sendConfirmMessage(chatId: number, text: string, imageUrl?: string): Promise<void> {
	const keyboard = {
		inline_keyboard: [[{ text: '✅ Sim, é esse!', callback_data: 'confirm:yes' }], [{ text: '❌ Não', callback_data: 'confirm:no' }]],
	};
	const msg = await getBot().api.sendMessage(chatId, text || 'Confirmar?', { parse_mode: 'Markdown', reply_markup: keyboard });
	if (imageUrl) {
		getBot().api.sendPhoto(chatId, imageUrl, { caption: text, parse_mode: 'Markdown' }).catch(() => {});
	}
}

export function registerTelegramWebhook(app: Hono) {
	app.post('/webhook/telegram', async (c) => {
		try {
			const update = await c.req.json();

			// Handle callback queries
			if (update.callback_query) {
				const cb = update.callback_query;
				const data = cb.data as string | undefined;
				const chatId = cb.message?.chat?.id;
				const messageId = cb.message?.message_id;

				if (chatId && messageId) {
					try {
						// Always answer callback query IMMEDIATELY to prevent Telegram retry
						if (cb.id) await getBot().api.answerCallbackQuery(cb.id).catch(() => {});

						// Clarify: user chose an option
						if (data?.startsWith('clarify:')) {
							const choice = decodeURIComponent(data.slice('clarify:'.length));
							try {
								await getBot().api.editMessageText(chatId, messageId, `*Você escolheu:* ${choice}`, {
									parse_mode: 'Markdown',
									reply_markup: undefined,
								});
							} catch {}
							const sessionKey = resolveSessionKey('telegram', String(chatId));
							const systemPrompt = await runtime.contextAssembler.buildFromSessionKey(sessionKey, choice);
							const result = await runtime.kernel.runTurn({
								sessionKey,
								userMessage: choice,
								systemPrompt: systemPrompt.systemPrompt,
							});
							if (result?.text) {
								await sendTelegramMessage(chatId, result.text).catch(() => {});
							}
							return c.json({ ok: true });
						}

						// Confirm: yes/no after display_content
						if (data === 'confirm:yes' || data === 'confirm:no') {
							if (data === 'confirm:no') {
								try {
									await getBot().api.editMessageCaption(chatId, messageId, { reply_markup: undefined });
								} catch {}
								const ctx = lastClarifyContext.get(chatId);
								if (ctx) {
									sendClarifyMessage(chatId, ctx.question, ctx.choices).catch(() => {});
								} else {
									await sendTelegramMessage(chatId, 'Ok, me diga novamente o que quer salvar!').catch(() => {});
								}
								return c.json({ ok: true });
							}
							// confirm:yes
							try {
								await getBot().api.editMessageCaption(chatId, messageId, { reply_markup: undefined });
							} catch {}
							const sessionKey = resolveSessionKey('telegram', String(chatId));
							const systemPrompt = await runtime.contextAssembler.buildFromSessionKey(sessionKey, 'confirmar e salvar');
							const result = await runtime.kernel.runTurn({
								sessionKey,
								userMessage: 'confirmar e salvar',
								systemPrompt: systemPrompt.systemPrompt,
							});
							if (result?.text) {
								await sendTelegramMessage(chatId, result.text).catch(() => {});
							}
							return c.json({ ok: true });
						}
					} catch (e) {
						console.error('Callback handler error:', e);
						return c.json({ ok: true });
					}
				}

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
			let skipFinalResponse = false;

			try {
				lastClarifyContext.delete(msg.chatId);
				const systemPrompt = await runtime.contextAssembler.buildFromSessionKey(sessionKey, msg.text);
				const callbacks: KernelCallbacks = {
					onToolStart: (toolName, input) => {
						if (toolName === 'display_content') {
							const data = input as any;
							const title = (data?.title || '').replace(/[*_]/g, '');
							const desc = (data?.description || '').replace(/[*_]/g, '');
							const text = title ? `*${title}*\n\n${desc}` : (desc || 'É esse mesmo?');
							sendConfirmMessage(msg.chatId, text, data?.imageUrl)
								.then(() => { skipFinalResponse = true; })
								.catch(() => {});
							return;
						}
						if (toolName === 'clarify') {
							const data = input as any;
							lastClarifyContext.set(msg.chatId, {
								question: data.question || '',
								choices: data.choices || [],
							});
							sendClarifyMessage(msg.chatId, data.question || '', data.choices || [])
								.then(() => { skipFinalResponse = true; })
								.catch(() => {});
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

				// 4. Send final response (skip if clarify already sent the buttons)
				if (result.text && !skipFinalResponse) {
					await sendTelegramMessage(msg.chatId, result.text);
				}
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
