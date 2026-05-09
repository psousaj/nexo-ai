import type { InterruptSignal, KernelCallbacks } from '@/core/kernel/hermes-kernel';
import { sttService } from '@/core/enrichment/stt-service';
import { ttsService } from '@/core/enrichment/tts-service';
import { visionService } from '@/core/enrichment/vision-service';
import { resolveSessionKey } from '@/core/registries/session-registry';
import { createHermesRuntime } from '@/core/runtime/hermes-runtime';
import type { Hono } from 'hono';
import { getBot } from '../../channels/telegram/bot';
import {
	downloadTelegramFile,
	editMessageText,
	extractTelegramMessage,
	sendClarifyMessage,
	sendProgressMessage,
	sendTelegramMessage,
	sendTelegramVoice,
	sendTypingAction,
	setMessageReaction,
	telegramUpdateToEnvelope,
} from '../../channels/telegram/dispatcher';

const runtime = createHermesRuntime();
const lastClarifyContext = new Map<number, { question: string; choices: string[] }>();
const lastClarifyMsgId = new Map<number, number>();
const activeSignals = new Map<string, InterruptSignal>();
const pendingMessages = new Map<string, string>();

async function processPendingMessage(sessionKey: string, chatId: number, message: string) {
	const systemPrompt = await runtime.contextAssembler.buildFromSessionKey(sessionKey, message);
	const result = await runtime.kernel.runTurn(
		{ sessionKey, userMessage: message, systemPrompt: systemPrompt.systemPrompt },
		undefined,
		undefined,
	);
	if (result.text) {
		await sendTelegramMessage(chatId, result.text).catch(() => {});
	}
}

async function sendConfirmMessage(chatId: number, text: string, imageUrl?: string): Promise<void> {
	const keyboard = {
		inline_keyboard: [[{ text: '✅ Sim, é esse!', callback_data: 'confirm:yes' }], [{ text: '❌ Não', callback_data: 'confirm:no' }]],
	};
	if (imageUrl) {
		try {
			await getBot().api.sendPhoto(chatId, imageUrl, { caption: text, parse_mode: 'Markdown', reply_markup: keyboard });
			return;
		} catch {}
	}
	await getBot().api.sendMessage(chatId, text || 'Confirmar?', { parse_mode: 'Markdown', reply_markup: keyboard });
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
					const sessionKey = resolveSessionKey('telegram', String(chatId));
					const cbSignal: InterruptSignal = { requested: false, message: null };
					activeSignals.set(sessionKey, cbSignal);
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
							const systemPrompt = await runtime.contextAssembler.buildFromSessionKey(sessionKey, choice);
							const result = await runtime.kernel.runTurn(
								{ sessionKey, userMessage: choice, systemPrompt: systemPrompt.systemPrompt },
								undefined,
								cbSignal,
							);
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
							const systemPrompt = await runtime.contextAssembler.buildFromSessionKey(sessionKey, 'confirmar e salvar');
							const result = await runtime.kernel.runTurn(
								{ sessionKey, userMessage: 'confirmar e salvar', systemPrompt: systemPrompt.systemPrompt },
								undefined,
								cbSignal,
							);
							if (result?.text) {
								await sendTelegramMessage(chatId, result.text).catch(() => {});
							}
							return c.json({ ok: true });
						}
					} catch (e) {
						console.error('Callback handler error:', e);
					} finally {
						activeSignals.delete(sessionKey);
					}

					// Drain pending from callback handler
					const cbPending = pendingMessages.get(sessionKey);
					if (cbPending) {
						pendingMessages.delete(sessionKey);
						processPendingMessage(sessionKey, chatId, cbPending);
					}

					return c.json({ ok: true });
				}

				return c.json({ ok: true });
			}

			const envelope = telegramUpdateToEnvelope(update);
			if (!envelope) return c.json({ ok: true });

			const sessionKey = resolveSessionKey('telegram', envelope.payload.incomingMsg.externalId);
			const msg = extractTelegramMessage(envelope);

			// Interrupt: if already processing, signal interrupt + queue pending
			const existingSignal = activeSignals.get(sessionKey);
			if (existingSignal) {
				existingSignal.requested = true;
				existingSignal.message = msg.text;
				pendingMessages.set(sessionKey, msg.text);
				setMessageReaction(msg.chatId, msg.messageId, '⏳').catch(() => {});
				return c.json({ ok: true });
			}

			const signal: InterruptSignal = { requested: false, message: null };
			activeSignals.set(sessionKey, signal);

			// Clean up pending clarify buttons if user sends text instead of clicking
			const pendingMsgId = lastClarifyMsgId.get(msg.chatId);
			if (pendingMsgId) {
				lastClarifyMsgId.delete(msg.chatId);
				lastClarifyContext.delete(msg.chatId);
				getBot().api.editMessageReplyMarkup(msg.chatId, pendingMsgId, {}).catch(() => {});
			}

			let userMessage = msg.text;
			let progressText = '';

			// Voice message: download audio + transcribe via STT
			if (update.message?.voice && !userMessage) {
				const voiceId = update.message.voice.file_id;
				progressText = '🎙️ Transcrevendo áudio...\n';
				const audioBuffer = await downloadTelegramFile(voiceId);
				if (audioBuffer) {
					const transcript = await sttService.transcribe(audioBuffer.toString('base64'));
					if (transcript) {
						userMessage = transcript;
					} else {
						userMessage = '[Áudio não reconhecido]';
					}
				}
				if (!userMessage) userMessage = '[Mensagem de áudio]';
			}

			// Image message: download + describe via Gemini Vision
			if (update.message?.photo && update.message.photo.length > 0) {
				progressText += '🔍 Analisando imagem...\n';
				const photo = update.message.photo[update.message.photo.length - 1]; // highest res
				const imageBuffer = await downloadTelegramFile(photo.file_id);
				if (imageBuffer) {
					const description = await visionService.describe(imageBuffer.toString('base64'));
					if (description) {
						userMessage = userMessage
							? `${userMessage}\n\n[O usuário enviou uma imagem. Análise automática: ${description}]`
							: `[O usuário enviou uma imagem. Análise automática: ${description}]`;
					}
				}
			}

			const userMessageId = msg.messageId;
			const hasImage = update.message?.photo && update.message.photo.length > 0;

			// 👀 1. Reaction: visual feedback
			await setMessageReaction(msg.chatId, userMessageId, hasImage ? '🔍' : '👀');

			// 2. Start typing indicator (runs in background)
			const typingInterval = setInterval(() => {
				sendTypingAction(msg.chatId).catch(() => {});
			}, 4000);

			let progressMessageId: number | null = null;
			let skipFinalResponse = false;

			try {
				const systemPrompt = await runtime.contextAssembler.buildFromSessionKey(sessionKey, msg.text);
				const callbacks: KernelCallbacks = {
					onToolStart: (toolName, input) => {
						if (toolName === 'display_content') {
						skipFinalResponse = true;
						const data = input as any;
						const title = (data?.title || '').replace(/[*_]/g, '');
						const desc = (data?.description || '').replace(/[*_]/g, '');
						const text = title ? `*${title}*\n\n${desc}` : (desc || 'É esse mesmo?');
						sendConfirmMessage(msg.chatId, text, data?.imageUrl).catch(() => {});
						return;
					}
					if (toolName === 'clarify') {
						skipFinalResponse = true;
						const data = input as any;
						lastClarifyContext.set(msg.chatId, { question: data.question || '', choices: data.choices || [] });
						sendClarifyMessage(msg.chatId, data.question || '', data.choices || [])
							.then((msgId) => { if (msgId) lastClarifyMsgId.set(msg.chatId, msgId); })
							.catch(() => {});
						return;
					}
					if (toolName === 'text_to_speech') {
						const data = input as any;
						if (!data?.text) return;
						ttsService.synthesize(data.text).then((buffer) => {
							if (buffer) {
								console.log(`[TTS] Generated ${buffer.length} bytes, sending voice...`);
								sendTelegramVoice(msg.chatId, buffer).then(() => {
									console.log(`[TTS] Voice sent!`);
								}).catch((e) => console.error('[TTS] sendVoice error:', e));
							} else {
								console.log('[TTS] Synthesize returned null — Cloudflare API may have failed');
							}
						}).catch((e) => console.error('[TTS] synthesize error:', e));
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
					{ sessionKey, userMessage, systemPrompt: systemPrompt.systemPrompt },
					callbacks,
					signal,
				);

				// 👍 3. Reaction: deu certo
				await setMessageReaction(msg.chatId, userMessageId, '👍');

				// 4. Send final response (skip if interrupted or clarify already sent buttons)
				if (!result.interrupted && result.text && !skipFinalResponse) {
					await sendTelegramMessage(msg.chatId, result.text);
				}
			} finally {
				clearInterval(typingInterval);
				activeSignals.delete(sessionKey);
			}

			// Drain pending: if user messaged during processing, process it now
			const pending = pendingMessages.get(sessionKey);
			if (pending) {
				pendingMessages.delete(sessionKey);
				processPendingMessage(sessionKey, msg.chatId, pending);
			}

			return c.json({ ok: true, sessionKey });
		} catch (error) {
			console.error('Telegram webhook error:', error);
			return c.json({ ok: false, error: 'Internal error' }, 500);
		}
	});
}
