import type { IncomingMessage, MessagingProvider } from '@/adapters/messaging';
import { env } from '@/config/env';
import {
	ERROR_MESSAGES,
	FALLBACK_MESSAGES,
	TIMEOUT_MESSAGE,
	getChannelSignupRequiredMessage,
	getChannelTrialExceededMessage,
	getRandomMessage,
} from '@/config/prompts';
import { agentOrchestrator } from '@/services/agent-orchestrator';
import { commandHandlerService } from '@/services/command-handler.service';
import { conversationService } from '@/services/conversation-service';
import { messageAnalyzer } from '@/services/message-analysis/message-analyzer.service';
import { applyMultimodalRuntime } from '@/services/multimodal-runtime';
import { onboardingService } from '@/services/onboarding-service';
import { cancelConversationClose } from '@/services/queue-service';
import { resolveSessionKey } from '@/services/session-key-resolver';
import { userService } from '@/services/user-service';
import { loggers } from '@/utils/logger';
import { startObservation } from '@langfuse/tracing';
import { recordException, setAttributes, startSpan } from '@nexo/otel/tracing';
import * as Sentry from '@sentry/node';

export const userTimeouts = new Map<string, number>();

interface ProcessMessageOptions {
	shouldNotifyUserOnProcessingError?: boolean;
}

/**
 * Verifica se a mensagem contém conteúdo ofensivo usando nlp.js
 */
async function containsOffensiveContent(message: string): Promise<boolean> {
	return startSpan('offensive_content.check', async (_span) => {
		setAttributes({ 'message.length': message.length });

		const sentiment = await messageAnalyzer.analyzeSentiment(message);

		setAttributes({
			'sentiment.score': sentiment.score,
			'sentiment.label': sentiment.sentiment,
			'offensive.is_offensive': sentiment.score < -3,
		});

		loggers.webhook.info(
			{ score: sentiment.score, sentiment: sentiment.sentiment, message },
			'🛡️ Sentiment Analysis (nlp.js)',
		);

		return sentiment.score < -3;
	});
}

async function isUserInTimeout(userId: string, externalId: string): Promise<boolean> {
	const user = await userService.getUserById(userId);
	if (user?.timeoutUntil) {
		const now = new Date();
		if (now < user.timeoutUntil) return true;
	}
	const timeoutUntil = userTimeouts.get(externalId);
	if (timeoutUntil && Date.now() < timeoutUntil) return true;
	return false;
}

async function applyTimeout(userId: string, externalId: string): Promise<number> {
	const user = await userService.getUserById(userId);
	const offenseCount = (user?.offenseCount || 0) + 1;
	let timeoutMinutes: number;
	if (offenseCount === 1) timeoutMinutes = 5;
	else if (offenseCount === 2) timeoutMinutes = 15;
	else if (offenseCount === 3) timeoutMinutes = 30;
	else timeoutMinutes = 60;
	const timeoutUntil = new Date(Date.now() + timeoutMinutes * 60 * 1000);
	await userService.updateUserTimeout(userId, timeoutUntil, offenseCount);
	userTimeouts.set(externalId, timeoutUntil.getTime());
	return timeoutMinutes;
}

export async function processMessage(
	incomingMsg: IncomingMessage,
	provider: MessagingProvider,
	options: ProcessMessageOptions = {},
) {
	const messageText = incomingMsg.text;

	return Sentry.startSpan(
		{
			name: 'message-processing',
			op: 'queue.message.process',
			attributes: {
				'message.provider': provider.getProviderName(),
				'message.external_id': incomingMsg.externalId,
				'message.id': incomingMsg.messageId || 'unknown',
				'message.has_callback': !!incomingMsg.callbackData,
				'message.text_length': messageText?.length || 0,
			},
		},
		async () => {
			const rootObservation = startObservation(
				'message-processing',
				{
					input: {
						provider: provider.getProviderName(),
						externalId: incomingMsg.externalId,
						messageId: incomingMsg.messageId,
						callbackData: incomingMsg.callbackData || null,
						message: messageText || '',
					},
					metadata: {
						source: 'message-service',
					},
				},
				{ asType: 'span' },
			);

			try {
				const result = await startSpan('message.process', async (_span) => {
					setAttributes({
						'message.provider': provider.getProviderName(),
						'message.external_id': incomingMsg.externalId,
						'message.text_length': messageText?.length || 0,
						'message.has_callback': !!incomingMsg.callbackData,
					});

					loggers.webhook.info(
						{ provider: provider.getProviderName(), externalId: incomingMsg.externalId, message: messageText },
						'📥 Mensagem recebida (Worker)',
					);

					// 0. IGNORA MENSAGENS VAZIAS (callback_data de botões, etc)
					if (!messageText || messageText.trim().length === 0) {
						setAttributes({ 'message.status': 'empty_ignored' });
						loggers.webhook.info('⚠️ Mensagem vazia ignorada (provavelmente callback_data)');
						return;
					}

					// 1. VERIFICA COMANDOS DE SISTEMA (AGNÓSTICO)
					const handledAsCommand = await startSpan('command.check', async () => {
						return await commandHandlerService.handleCommand(incomingMsg, provider);
					});

					if (handledAsCommand) {
						setAttributes({ 'message.type': 'command' });
						loggers.webhook.info('🤖 Comando de sistema processado, encerrando fluxo normal');
						return;
					}

					const startTotal = performance.now();
					let userId: string | undefined;
					let conversationId: string | undefined;

					try {
						// 2. VERIFICA CONTEÚDO OFENSIVO
						const isOffensive = await containsOffensiveContent(messageText);

						if (isOffensive) {
							setAttributes({ 'message.status': 'offensive_blocked' });

							const { user } = await startSpan('user.find_or_create', async () => {
								return await userService.findOrCreateUserByAccount(
									incomingMsg.externalId,
									incomingMsg.provider,
									incomingMsg.senderName,
									incomingMsg.phoneNumber,
								);
							});

							userId = user.id;
							setAttributes({ 'user.id': user.id, 'user.offense_count': user.offenseCount || 0 });

							const timeoutMinutes = await applyTimeout(user.id, incomingMsg.externalId);
							setAttributes({ 'timeout.minutes': timeoutMinutes });

							await provider.sendMessage(incomingMsg.externalId, TIMEOUT_MESSAGE(timeoutMinutes));
							return;
						}

						// 3. FIND OR CREATE USER
						const { user } = await startSpan('user.find_or_create', async () => {
							return await userService.findOrCreateUserByAccount(
								incomingMsg.externalId,
								incomingMsg.provider,
								incomingMsg.senderName,
								incomingMsg.phoneNumber,
							);
						});

						userId = user.id;
						setAttributes({ 'user.id': user.id, 'user.status': user.status });

						if (incomingMsg.senderName && incomingMsg.senderName !== user.name) {
							await userService.updateUserName(user.id, incomingMsg.senderName);
						}

						// Check timeout
						if (await isUserInTimeout(user.id, incomingMsg.externalId)) {
							setAttributes({ 'message.status': 'user_timeout' });
							return;
						}

						// 4. GET OR CREATE CONVERSATION
						const conversation = await startSpan('conversation.get_or_create', async () => {
							return await conversationService.findOrCreateConversation(user.id);
						});

						conversationId = conversation.id;
						setAttributes({
							'conversation.id': conversation.id,
							'conversation.state': conversation.state,
						});

						if (conversation.state === 'waiting_close') {
							await cancelConversationClose(conversation.id);
						}

						// 5. VERIFICA ONBOARDING (PHASE 2)
						const onboarding = await startSpan('onboarding.check', async () => {
							const { onboardingService } = await import('@/services/onboarding-service');
							const result = await onboardingService.checkOnboardingStatus(user.id, provider.getProviderName());
							setAttributes({
								'onboarding.allowed': result.allowed,
								'onboarding.reason': result.reason || 'none',
								'onboarding.interactions_remaining': (result as any).interactionsRemaining,
							});
							return result;
						});

						if (!onboarding.allowed) {
							setAttributes({ 'message.status': 'onboarding_blocked' });

							const { accountLinkingService } = await import('@/services/account-linking-service');
							const dashboardUrl = `${env.DASHBOARD_URL}/signup`;
							const isLocalhost = dashboardUrl.includes('localhost') || dashboardUrl.includes('127.0.0.1');
							const providerName = provider.getProviderName();

							if (isLocalhost && providerName === 'telegram') {
								loggers.webhook.error(
									{ dashboardUrl },
									'⚠️ DASHBOARD_URL é localhost - Telegram não aceita localhost em botões. Configure uma URL pública (ngrok/zrok) no .env',
								);
							}

							if (onboarding.reason === 'trial_exceeded') {
								// Se tiver conta vinculada, considera como falha de estado mas não bloqueia com mensagem de trial
								// (Pode ser um erro de cache ou estado, mas evita spam de trial para usuários registrados)
								if (user.status === 'active') {
									loggers.webhook.warn(
										{ userId: user.id },
										'⚠️ Usuário ativo recebeu trial_exceeded - corrigindo estado ou ignorando',
									);
									// Força update se necessário ou segue fluxo
								} else {
									// Verifica se o usuário tem conta vinculada no UserService
									const accounts = await userService.getUserAccounts(user.id);
									const hasLinkedAccount = accounts.some((acc) => acc.provider !== 'whatsapp'); // Assume que 'whatsapp' é o canal atual restrito

									if (hasLinkedAccount) {
										// Se tem conta vinculada, deveria estar active. Tenta corrigir ou logar erro.
										loggers.webhook.warn(
											{ userId: user.id },
											'⚠️ Usuário vinculado caiu no trial_exceeded - checkOnboardingStatus retornou false',
										);
										// Opcional: Auto-ativar usuário?
										// Por segurança, não bloqueia o fluxo.
									} else {
										const signupToken = await accountLinkingService.generateLinkingToken(user.id, 'whatsapp', 'signup');
										const signupLink = `${dashboardUrl}?vinculate_code=${signupToken}`;
										const trialMessage = getChannelTrialExceededMessage(providerName, signupLink);

										if (providerName === 'telegram') {
											// Se for localhost, envia texto simples (Telegram não aceita localhost em botões)
											if (isLocalhost) {
												await provider.sendMessage(
													incomingMsg.externalId,
													`${trialMessage}\n\n⚠️ (URL local - configure DASHBOARD_URL público no .env)`,
												);
											} else {
												const buttons = [[{ text: '🔗 Clique aqui para criar conta', url: signupLink }]];
												await (provider as any).sendMessageWithButtons(incomingMsg.externalId, trialMessage, buttons);
											}
										} else {
											await provider.sendMessage(incomingMsg.externalId, trialMessage);
										}
										return;
									}
								}
							}

							if (onboarding.reason === 'signup_required') {
								const accounts = await userService.getUserAccounts(user.id);
								const isNewUser = accounts.length <= 1;

								if (isNewUser) {
									const signupToken = await accountLinkingService.generateLinkingToken(
										user.id,
										providerName as any,
										'signup',
									);
									const signupLink = `${dashboardUrl}?vinculate_code=${signupToken}`;
									const signupRequiredMessage = getChannelSignupRequiredMessage(providerName, signupLink);

									if (providerName === 'telegram') {
										// Se for localhost, envia texto simples (Telegram não aceita localhost em botões)
										if (isLocalhost) {
											await provider.sendMessage(
												incomingMsg.externalId,
												`${signupRequiredMessage}\n\n⚠️ (URL local - configure DASHBOARD_URL público no .env)`,
											);
										} else {
											const buttons = [[{ text: '🔗 Clique aqui para cadastrar', url: signupLink }]];
											await (provider as any).sendMessageWithButtons(
												incomingMsg.externalId,
												signupRequiredMessage,
												buttons,
											);
										}
									} else {
										await provider.sendMessage(incomingMsg.externalId, signupRequiredMessage);
									}
									return;
								}
								// Se tem mais contas, assume que é usuário existente e permite fluxo (provavelmente status desatualizado)
								// Loga para debug
								loggers.webhook.info(
									{ userId: user.id, accounts: accounts.length },
									'ℹ️ Usuário multi-conta pending_signup ignorando bloqueio',
								);
							}
						}

						// Incrementa interações APENAS se não for bloqueado
						await onboardingService.incrementInteractionCount(user.id);

						// Envia indicador "digitando..." para o usuário enquanto processa IA
						if (provider.getProviderName() === 'telegram') {
							await (provider as any).sendChatAction(incomingMsg.externalId, 'typing');
						}

						// 6. PROCESSA COM AGENT ORCHESTRATOR
						const multimodalRuntime = await startSpan('message.multimodal_runtime', async () => {
							return await applyMultimodalRuntime(messageText, incomingMsg.metadata);
						});

						const agentResponse = await startSpan('agent.process_message', async (_agentSpan) => {
							const sessionKey = resolveSessionKey(incomingMsg);

							return await agentOrchestrator.processMessage({
								userId: user.id,
								conversationId: conversation.id,
								externalId: incomingMsg.externalId,
								message: multimodalRuntime.message,
								callbackData: incomingMsg.callbackData,
								provider: provider.getProviderName(),
								providerMessageId: incomingMsg.messageId,
								providerPayload: multimodalRuntime.providerPayload,
								sessionKey,
							});
						});

						// 7. ENVIA RESPOSTA
						if (agentResponse.message && agentResponse.message.trim().length > 0) {
							await startSpan('messaging.send', async () => {
								setAttributes({
									'response.length': agentResponse.message.length,
									'response.tools_used': agentResponse.toolsUsed?.length || 0,
									'response.state': agentResponse.state,
								});

								try {
									await provider.sendMessage(incomingMsg.externalId, agentResponse.message);
									loggers.webhook.info({ charCount: agentResponse.message.length }, '📤 Resposta enviada');
								} catch (sendError: any) {
									// Se erro de rede (ETIMEDOUT, ECONNREFUSED), não tenta fallback
									if (sendError.cause?.code === 'ETIMEDOUT' || sendError.cause?.code === 'ECONNREFUSED') {
										loggers.webhook.error(
											{ error: sendError.cause?.code },
											'❌ Erro de rede ao enviar mensagem - não enviando fallback',
										);
										throw sendError; // Re-throw para Bull não fazer retry
									}
									throw sendError;
								}
							});
						} else if (!agentResponse.skipFallback && agentResponse.state !== 'awaiting_context') {
							// Fallback apenas se não foi enviado manualmente via adapter
							// E se não estamos aguardando clarificação (mensagem já foi enviada pelo conversationService)
							setAttributes({ 'response.type': 'fallback' });

							const fallbackMsg = getRandomMessage(FALLBACK_MESSAGES);
							try {
								await provider.sendMessage(incomingMsg.externalId, fallbackMsg);
								loggers.webhook.info({ fallback: fallbackMsg }, '🚫 NOOP/Empty - enviando fallback');
							} catch (sendError: any) {
								// Se erro de rede, apenas loga e retorna
								if (sendError.cause?.code === 'ETIMEDOUT' || sendError.cause?.code === 'ECONNREFUSED') {
									loggers.webhook.error(
										{ error: sendError.cause?.code },
										'❌ Erro de rede ao enviar fallback - abortando',
									);
									throw sendError;
								}
								throw sendError;
							}
						}

						if (agentResponse.toolsUsed && agentResponse.toolsUsed.length > 0) {
							setAttributes({ 'tools.count': agentResponse.toolsUsed.length });
							loggers.webhook.info({ tools: agentResponse.toolsUsed }, '🔧 Tools usadas');
						}

						const endTotal = performance.now();
						loggers.webhook.info(
							{ duration: `${(endTotal - startTotal).toFixed(0)}*ms*` },
							'🏁 Processamento finalizado',
						);
					} catch (error: any) {
						recordException(error as Error, {
							'user.id': userId,
							'conversation.id': conversationId,
						});

						// Anexa contexto capturado para o Global Error Handler
						error.userId = userId;
						error.conversationId = conversationId;
						// Apenas tenta avisar o usuário se não for erro de conexão
						// O Global Error Handler (via Queue) vai cuidar de logar e persistir tudo com contexto
						const shouldNotifyUserOnProcessingError = options.shouldNotifyUserOnProcessingError ?? true;
						if (
							shouldNotifyUserOnProcessingError &&
							error.cause?.code !== 'ETIMEDOUT' &&
							error.cause?.code !== 'ECONNREFUSED'
						) {
							try {
								const errorMsg = getRandomMessage(ERROR_MESSAGES);
								await provider.sendMessage(incomingMsg.externalId, errorMsg);
							} catch (_sendError) {
								// Ignora erro de envio de falha
							}
						} else if (!shouldNotifyUserOnProcessingError) {
							loggers.webhook.warn(
								{ externalId: incomingMsg.externalId },
								'⚠️ Erro de processamento sem notificar usuário (tentativa intermediária)',
							);
						}

						// Re-throw OBRIGATÓRIO para o Bull capturar e chamar worker.on('failed') -> GlobalErrorHandler
						throw error;
					}
				});

				rootObservation
					.update({
						output: {
							status: 'success',
							provider: provider.getProviderName(),
							externalId: incomingMsg.externalId,
						},
					})
					.end();

				return result;
			} catch (error) {
				rootObservation
					.update({
						output: {
							status: 'error',
							provider: provider.getProviderName(),
							externalId: incomingMsg.externalId,
						},
						level: 'ERROR',
						statusMessage: error instanceof Error ? error.message : String(error),
					})
					.end();

				Sentry.captureException(error, {
					tags: {
						provider: provider.getProviderName(),
						externalId: incomingMsg.externalId,
					},
				});

				throw error;
			}
		},
	);
}
