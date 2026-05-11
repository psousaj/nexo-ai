import { sttService } from '@/core/enrichment/stt-service';
import { ttsService } from '@/core/enrichment/tts-service';
import { visionService } from '@/core/enrichment/vision-service';
import type { InterruptSignal, KernelCallbacks } from '@/core/kernel/hermes-kernel';
import { PostgresSessionRegistry, resolveSessionKey } from '@/core/registries/session-registry';
import { createHermesRuntime } from '@/core/runtime/hermes-runtime';
import { AgentCache, hashToolCatalog, hashSystemPrompt } from '@/core/cache/agent-cache';
import { SessionStore } from '@/core/session/session-store';
import { loggers } from '@/utils/logger';
import type { SessionSource } from '@/core/session/session-context-builder';
const log = loggers.webhook;
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

const baseRuntime = createHermesRuntime();
const agentCache = new AgentCache();
const sessionStore = new SessionStore({
	sessionRegistry: new PostgresSessionRegistry(),
	hasActiveProcesses: (sessionKey) => activeSignals.has(sessionKey),
});
const lastClarifyContext = new Map<number, { question: string; choices: string[] }>();
const lastClarifyMsgId = new Map<number, number>();
const activeSignals = new Map<string, InterruptSignal>();
const pendingMessages = new Map<string, string>();

async function resolveCachedRuntime(sessionKey: string, message?: string, sessionSource?: SessionSource) {
	const contextResult = await baseRuntime.contextAssembler.buildFromSessionKey(sessionKey, message, sessionSource);
	const catalog = await baseRuntime.toolRegistry.buildHermesToolCatalog();
	const sessionData = await baseRuntime.sessionRegistry.load(sessionKey);
	const sessionId = sessionData?.id as string | undefined;
	const signature = AgentCache.computeSignature(
		'gpt-4o-mini',
		hashToolCatalog(catalog),
		hashSystemPrompt(contextResult.systemPrompt),
	);
	let runtime = agentCache.get(sessionKey, signature);
	if (!runtime) {
		runtime = createHermesRuntime({ sessionId });
		agentCache.set(sessionKey, signature, runtime);
	}
	return { runtime, systemPrompt: contextResult.systemPrompt, sessionContext: contextResult.sessionContext };
}

function buildToolCallbacks(
	chatId: number,
	skipFlag: { value: boolean },
	progress: { text: string; msgId: number | null },
): KernelCallbacks {
	return {
		onToolStart: async (toolName, input) => {
			if (toolName === 'send_confirm') {
				const data = input as any;
				skipFlag.value = true;
				const keyb = { inline_keyboard: [[{ text: '✅ Sim, é esse!', callback_data: 'confirm:yes' }], [{ text: '❌ Não', callback_data: 'confirm:no' }]] };
				if (data?.imageUrl) {
					const cap = (data?.title || '').replace(/[*_\[\]()~`>#+\-=|{}.!]/g, '') || 'É esse mesmo?';
					getBot().api.sendPhoto(chatId, data.imageUrl, { caption: cap, reply_markup: keyb }).catch(() => {
						getBot().api.sendMessage(chatId, cap, { reply_markup: keyb }).catch(() => {});
					});
				}
				return;
			}
			if (toolName === 'clarify') {
				skipFlag.value = true;
				const data = input as any;
				log.debug('[clarify] question:', data.question, 'choices:', JSON.stringify(data.choices));
				lastClarifyContext.set(chatId, { question: data.question || '', choices: data.choices || [] });
				const msgId = await sendClarifyMessage(chatId, data.question || '', data.choices || []);
				if (msgId) lastClarifyMsgId.set(chatId, msgId);
				return;
			}
			if (toolName === 'text_to_speech') {
				const data = input as any;
				if (!data?.text) return;
				try {
					const buffer = await ttsService.synthesize(data.text);
					if (buffer) await sendTelegramVoice(chatId, buffer);
				} catch (e) {
					log.error('[TTS] error:', e);
				}
				return;
			}
			progress.text += `🔍 *${toolName}*...\n`;
			if (progress.msgId) {
				editMessageText(chatId, progress.msgId, progress.text).catch(() => {});
			} else {
				sendProgressMessage(chatId, progress.text)
					.then((id) => {
						progress.msgId = id;
					})
					.catch(() => {});
			}
		},
		onToolEnd: (_toolName, _result) => {
			if (_toolName === 'send_confirm' || _toolName === 'clarify') return;
			progress.text = progress.text.replace(`🔍 *${_toolName}*...\n`, `✅ *${_toolName}* concluído\n`);
			if (progress.msgId) {
				editMessageText(chatId, progress.msgId, progress.text).catch(() => {});
			}
		},
	};
}

async function processPendingMessage(sessionKey: string, chatId: number, message: string, sessionSource?: SessionSource) {
	const { runtime, systemPrompt, sessionContext } = await resolveCachedRuntime(sessionKey, message, sessionSource);
	const userMessage = sessionContext
		? `${sessionContext}\n\n${message}`
		: message;
	const callbacks = buildToolCallbacks(chatId, { value: false }, { text: '', msgId: null });
	const result = await runtime.kernel.runTurn(
		{ sessionKey, userMessage, systemPrompt },
		callbacks,
		undefined,
	);
	if (result.text) {
		await sendTelegramMessage(chatId, result.text).catch(() => {});
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
					const sessionKey = resolveSessionKey('telegram', String(chatId));
					const cbSignal: InterruptSignal = { requested: false, message: null };
					const cbSessionSource: SessionSource = {
						platform: 'telegram',
						chatId: String(chatId),
						chatName: cb.message?.chat?.title,
						chatType: cb.message?.chat?.type === 'private' ? 'dm' : 'group',
						userId: String(cb.from?.id),
						userName: cb.from?.first_name,
					};
					activeSignals.set(sessionKey, cbSignal);
					try {
						// Always answer callback query IMMEDIATELY to prevent Telegram retry
						if (cb.id)
							await getBot()
								.api.answerCallbackQuery(cb.id)
								.catch(() => {});

						// Ensure session exists for callback queries
						const peerKind = String(chatId).startsWith('-') ? 'group' : 'direct';
						await sessionStore.getOrCreateSession(sessionKey, {
							channel: 'telegram',
							peerKind,
							peerId: String(chatId),
						});

						// Clarify: user chose an option
						if (data?.startsWith('clarify:')) {
							const choice = decodeURIComponent(data.slice('clarify:'.length));
							try {
								await getBot().api.editMessageText(chatId, messageId, `*Você escolheu:* ${choice}`, {
									parse_mode: 'Markdown',
									reply_markup: undefined,
								});
							} catch {}
							const { runtime, systemPrompt, sessionContext } = await resolveCachedRuntime(sessionKey, choice, cbSessionSource);
							const userMessage = sessionContext
								? `${sessionContext}\n\n${choice}`
								: choice;
							const cbProgress = { text: '', msgId: null as number | null };
							const cbSkip = { value: false };
							const cbCallbacks = buildToolCallbacks(chatId, cbSkip, cbProgress);
							const result = await runtime.kernel.runTurn(
								{ sessionKey, userMessage, systemPrompt },
								cbCallbacks,
								cbSignal,
							);
							if (result?.text) {
								await sendTelegramMessage(chatId, result.text).catch(() => {});
							}
							return c.json({ ok: true });
						}

						// Confirm: yes/no
						if (data === 'confirm:yes') {
							await getBot().api.editMessageReplyMarkup(chatId, messageId, {}).catch(() => {});
							const { runtime, systemPrompt, sessionContext } = await resolveCachedRuntime(sessionKey, 'confirmar e salvar', cbSessionSource);
							const userMessage = sessionContext
								? `${sessionContext}\n\nconfirmar e salvar`
								: 'confirmar e salvar';
							const confirmResult = await runtime.kernel.runTurn(
								{ sessionKey, userMessage, systemPrompt },
								undefined,
								cbSignal,
							);
							if (confirmResult?.text) {
								await sendTelegramMessage(chatId, confirmResult.text).catch(() => {});
							}
							return c.json({ ok: true });
						}

						if (data === 'confirm:no') {
							await getBot().api.editMessageReplyMarkup(chatId, messageId, {}).catch(() => {});
							const ctx = lastClarifyContext.get(chatId);
							if (ctx) {
								sendClarifyMessage(chatId, ctx.question, ctx.choices).catch(() => {});
							} else {
								await sendTelegramMessage(chatId, 'Me diga novamente o que quer salvar!').catch(() => {});
							}
							return c.json({ ok: true });
						}
					} catch (e) {
						log.error('Callback handler error:', e);
					} finally {
						activeSignals.delete(sessionKey);
						await sessionStore.touchSession(sessionKey).catch(() => {});
					}

					// Drain pending from callback handler
					const cbPending = pendingMessages.get(sessionKey);
					if (cbPending) {
						pendingMessages.delete(sessionKey);
						processPendingMessage(sessionKey, chatId, cbPending, cbSessionSource);
					}

					return c.json({ ok: true });
				}

				return c.json({ ok: true });
			}

			const envelope = telegramUpdateToEnvelope(update);
			if (!envelope) return c.json({ ok: true });

			const sessionKey = resolveSessionKey('telegram', envelope.payload.incomingMsg.externalId);
			const msg = extractTelegramMessage(envelope);

			// Resolve or create session with reset policy
			const peerKind = String(msg.chatId).startsWith('-') ? 'group' : 'direct';
			const { session, wasReset, resetReason } = await sessionStore.getOrCreateSession(sessionKey, {
				channel: 'telegram',
				peerKind,
				peerId: String(msg.chatId),
			});

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
				getBot()
					.api.editMessageReplyMarkup(msg.chatId, pendingMsgId, {})
					.catch(() => {});
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

			// Prepend reset notification if session was reset
			if (wasReset && resetReason) {
				const notification = sessionStore.getResetNotification(resetReason, 'telegram', session.peerKind === 'direct' ? 1440 : undefined);
				if (notification) {
					userMessage = `${notification}${userMessage}`;
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

			const progressMessageId: number | null = null;
			let skipFinalResponse = false;

			const sessionSource: SessionSource = {
				platform: 'telegram',
				chatId: String(msg.chatId),
				chatName: update.message?.chat?.title,
				chatType: update.message?.chat?.type === 'private' ? 'dm' : 'group',
				userId: String(update.message?.from?.id),
				userName: update.message?.from?.first_name,
			};

			try {
				const { runtime, systemPrompt, sessionContext } = await resolveCachedRuntime(sessionKey, msg.text, sessionSource);
				const finalUserMessage = sessionContext
					? `${sessionContext}\n\n${userMessage}`
					: userMessage;
				const skipFlag = { value: skipFinalResponse };
				const progress = { text: progressText, msgId: progressMessageId };
				const callbacks = buildToolCallbacks(msg.chatId, skipFlag, progress);

				const result = await runtime.kernel.runTurn(
					{ sessionKey, userMessage: finalUserMessage, systemPrompt },
					callbacks,
					signal,
				);

				skipFinalResponse = skipFlag.value;
				progressText = progress.text;

				// 👍 3. Reaction: deu certo
				await setMessageReaction(msg.chatId, userMessageId, '👍');

				// 4. Send final response (skip if interrupted or clarify already sent buttons)
				if (!result.interrupted && result.text && !skipFinalResponse) {
					await sendTelegramMessage(msg.chatId, result.text);
				}
			} finally {
				clearInterval(typingInterval);
				activeSignals.delete(sessionKey);
				await sessionStore.touchSession(sessionKey).catch(() => {});
			}

			// Drain pending: if user messaged during processing, process it now
			const pending = pendingMessages.get(sessionKey);
			if (pending) {
				pendingMessages.delete(sessionKey);
				processPendingMessage(sessionKey, msg.chatId, pending, sessionSource);
			}

			return c.json({ ok: true, sessionKey });
		} catch (error) {
			log.error('Telegram webhook error:', error);
			return c.json({ ok: false, error: 'Internal error' }, 500);
		}
	});
}
