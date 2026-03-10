/**
 * Orquestrador de Agente - Padrão Hugging Face Agents
 *
 * Arquitetura em camadas:
 * 1. Intent Classifier (determinístico) → decide ação
 * 2. State Machine → controla fluxo
 * 3. LLM (planner/writer) → escolhe tools e gera texto
 * 4. Tools (código) → executa ações
 *
 * LLM NUNCA:
 * - Gerencia estado
 * - Decide fluxo
 * - Executa lógica
 * - Controla loops
 * - É proativa
 *
 * LLM APENAS:
 * - Analisa
 * - Planeja
 * - Escolhe tools
 * - Redige respostas
 */

import { getPivotFeatureFlags } from '@/config/pivot-feature-flags';
import {
	AGENT_OUTPUT_CONTRACT_REPAIR_PROMPT,
	CANCELLATION_PROMPT,
	CASUAL_GREETINGS,
	CHOOSE_AGAIN_MESSAGES,
	ERROR_MESSAGES,
	NO_ITEMS_FOUND,
	SAVE_SUCCESS,
	applyAgentDecisionV2Contract,
	formatItemsList,
	getAgentSystemPrompt,
	getRandomMessage as getRandomResponse,
} from '@/config/prompts';
import { setSentryContext } from '@/sentry';
import { messageAnalyzer } from '@/services/message-analysis/message-analyzer.service';
import { instrumentService } from '@/services/service-instrumentation';
import { userService } from '@/services/user-service';
import type { AgentDecisionV2, ConversationState, ToolName } from '@/types';
import type { MessageMetadata, OrchestratorTrace } from '@/types';
import { parseAgentDecisionV2FromLLM } from '@/utils/json-parser';
import { loggers } from '@/utils/logger';
import { setAttributes, startSpan } from '@nexo/otel/tracing';
import { decideAgentAction } from './agent-action-routing';
import { canExecuteAgentDecisionV2Tool } from './agent-decision-v2-side-effect-gate';
import { llmService } from './ai';
import { buildAgentContext } from './context-builder'; // OpenClaw pattern
import { conversationService } from './conversation-service';
import { cancellationMessages, confirmationMessages, getRandomMessage } from './conversation/messageTemplates';
import { type IntentResult, intentClassifier } from './intent-classifier';
import { itemService } from './item-service';
import { scheduleConversationClose } from './queue-service';
import { toolAvailabilityService } from './tool-availability.service';
import { type ToolContext, executeTool } from './tools';

export interface AgentContext {
	userId: string;
	conversationId: string;
	externalId: string;
	message: string;
	// Telegram callback data
	callbackData?: string;
	provider: string; // Provider sempre obrigatório (vem do webhook)
	providerMessageId?: string;
	providerPayload?: Record<string, unknown>;
	// OpenClaw pattern: session key for context building
	sessionKey?: string; // Optional for backward compatibility
}

export interface AgentResponse {
	message: string;
	state: ConversationState;
	toolsUsed?: string[];
	skipFallback?: boolean; // Flag para não enviar fallback quando já enviou manualmente
	/** Trace parcial retornado por sub-handlers (ex: handleWithLLM) para ser mesclado no trace final */
	trace?: Partial<OrchestratorTrace>;
}

/**
 * Orquestrador principal do agente
 */
export class AgentOrchestrator {
	private readonly MAX_CLARIFICATION_ATTEMPTS = 4;

	private buildMessagePersistOptions(context: AgentContext, includeProviderMessage = false) {
		return {
			provider: context.provider,
			externalId: context.externalId,
			providerMessageId: includeProviderMessage ? context.providerMessageId : undefined,
			providerPayload: includeProviderMessage ? context.providerPayload : undefined,
		};
	}

	private buildMessagePersistOptionsWithTrace(context: AgentContext, trace: OrchestratorTrace) {
		return {
			...this.buildMessagePersistOptions(context),
			metadata: { _trace: trace } satisfies MessageMetadata,
		};
	}

	/**
	 * Processa mensagem do usuário
	 */
	async processMessage(context: AgentContext): Promise<AgentResponse> {
		return startSpan('agent.orchestrator.process', async (_span) => {
			setAttributes({
				'agent.user_id': context.userId,
				'agent.conversation_id': context.conversationId,
				'agent.has_callback': !!context.callbackData,
				'agent.message_length': context.message?.length || 0,
			});

			loggers.ai.info({ message: context.message }, '🎯 Processando mensagem');

			// Validação de mensagem vazia (callback_data, botões, etc)
			if (!context.message || context.message.trim().length === 0) {
				setAttributes({ 'agent.status': 'empty_message' });
				loggers.ai.warn('⚠️ Mensagem vazia recebida, ignorando processamento');
				return {
					message: '',
					state: 'idle' as const,
				};
			}

			// 0. BUSCAR ESTADO ATUAL
			const conversation = await startSpan('conversation.get_state', async () => {
				return await conversationService.findOrCreateConversation(context.userId, context.provider);
			});

			setAttributes({ 'conversation.state': conversation.state });
			loggers.ai.info({ state: conversation.state }, '📊 Estado atual');

			// A0. TRATAR ESTADO OFF_TOPIC_CHAT
			if (conversation.state === 'off_topic_chat') {
				// Re-classifica intenção para ver se usuário voltou ao escopo
				const intent = await intentClassifier.classify(context.message);

				// Se intenção for clara (confiança alta), reseta para idle e processa normalmente
				if (intent.intent !== 'unknown' && intent.confidence >= 0.85) {
					loggers.ai.info({ intent: intent.intent }, '🎯 Usuário voltou ao escopo, limpando off_topic');
					await conversationService.updateState(conversation.id, 'idle', {
						clarificationAttempts: 0,
						lastClarificationMessage: undefined,
					});
					conversation.state = 'idle';
					// Continua para o fluxo normal de processamento
				} else {
					// Continua em off_topic, responde com mensagem amigável aleatória
					const { OFF_TOPIC_MESSAGES, getRandomMessage } = await import('@/config/prompts');
					const responseMessage = getRandomMessage(OFF_TOPIC_MESSAGES);

					await conversationService.addMessage(
						conversation.id,
						'user',
						context.message,
						this.buildMessagePersistOptions(context, true),
					);
					await conversationService.addMessage(
						conversation.id,
						'assistant',
						responseMessage,
						this.buildMessagePersistOptions(context),
					);

					return {
						message: responseMessage,
						state: 'off_topic_chat',
						skipFallback: true,
					};
				}
			}

			// A. TRATAR ESTADO AWAITING_CONTEXT (Clarificação)
			if (conversation.state === 'awaiting_context') {
				return this.handleClarificationResponse(context, conversation);
			}

			// B. TRATAR CALLBACKS DO TELEGRAM (botões inline)
			// Quando há callbackData, são comandos internos do bot - não classificar via NLP
			if (context.callbackData) {
				const cb = context.callbackData;
				const isKnownCallback = cb.startsWith('select_') || cb === 'confirm_final' || cb === 'choose_again';

				if (
					isKnownCallback &&
					(conversation.state === 'awaiting_confirmation' || conversation.state === 'awaiting_final_confirmation')
				) {
					loggers.ai.info({ callbackData: cb, state: conversation.state }, '🔘 Callback do Telegram detectado');

					// Cria intent artificial para handleConfirmation
					const artificialIntent: IntentResult = {
						intent: 'confirm',
						action: 'confirm',
						confidence: 1.0,
					};

					return this.handleConfirmation(context, conversation, artificialIntent);
				}
			}

			// B2. GUARD: usuário digitou texto enquanto aguardamos seleção de botão
			if (
				!context.callbackData &&
				(conversation.state === 'awaiting_confirmation' || conversation.state === 'awaiting_final_confirmation')
			) {
				loggers.ai.info({ state: conversation.state }, '⚠️ Usuário digitou texto em estado de seleção');
				return {
					message: 'Ops... pra gente prosseguir, preciso que selecione um dos botões acima 👆',
					state: conversation.state as any,
				};
			}

			// 1. CLASSIFICAR INTENÇÃO (determinístico)
			const startTotal = performance.now();
			const startIntent = performance.now();
			const intent = await intentClassifier.classify(context.message);
			const endIntent = performance.now();
			loggers.ai.info(
				{
					intent: intent.intent,
					confidence: intent.confidence,
					duration: `${(endIntent - startIntent).toFixed(0)}*ms*`,
				},
				'🧠 Intenção detectada',
			);

			// 2. CHECAR AMBIGUIDADE (APENAS se intent for desconhecido ou baixa confiança)
			// Se neural/LLM classificou com confiança, NÃO pedir clarificação
			const intentIsKnown = intent.intent !== 'unknown' && intent.confidence >= 0.85;

			// Analisa tom para evitar tratar perguntas como itens ambíguos
			const tone = messageAnalyzer.checkTone(context.message);
			const isQuestion = tone.isQuestion;

			if (conversation.state === 'idle' && intent.intent !== 'casual_chat' && !intentIsKnown && !isQuestion) {
				const startAmbiguous = performance.now();
				// Multi-provider: usa provider do contexto (vem do webhook)
				if (!context.provider) {
					throw new Error('Provider não informado no contexto');
				}
				const providerType = context.provider as 'telegram' | 'whatsapp';
				const isAmbiguous = await conversationService.handleAmbiguousMessage(
					conversation.id,
					context.message,
					context.externalId,
					providerType,
				);
				const endAmbiguous = performance.now();

				if (isAmbiguous) {
					loggers.ai.info(
						{ duration: `${(endAmbiguous - startAmbiguous).toFixed(0)}*ms*` },
						'🔍 Ambiguidade detectada',
					);
					return {
						message: null as any, // Mensagem já enviada pelo conversationService
						state: 'awaiting_context', // Estado atualizado pelo service
						skipFallback: true, // Não enviar fallback - clarificação já foi enviada
					};
				}
			} else if (intentIsKnown) {
				loggers.ai.info(
					{ intent: intent.intent, confidence: intent.confidence.toFixed(2) },
					'✅ Intent claro, pulando verificação de ambiguidade',
				);
			}

			// 3. DECIDIR AÇÃO BASEADO EM INTENÇÃO + ESTADO
			const action = await this.decideAction(intent, conversation.state);

			// 4. EXECUTAR AÇÃO
			loggers.ai.info(
				{
					state: conversation.state,
					intent: intent.intent,
					actionDecided: action,
				},
				'⚡ Executando ação',
			);

			const startAction = performance.now();
			let response: AgentResponse;

			switch (action) {
				case 'handle_delete_all':
					response = await this.handleDeleteAll(context, intent, conversation);
					break;

				case 'handle_delete_item':
					response = await this.handleDeleteItem(context, intent);
					break;

				case 'handle_search':
					response = await this.handleSearch(context, intent);
					break;

				case 'handle_save_previous':
					response = await this.handleSavePrevious(context, conversation);
					break;

				case 'handle_with_llm':
					response = await this.handleWithLLM(context, intent, conversation);
					break;

				case 'handle_confirmation':
					response = await this.handleConfirmation(context, conversation, intent);
					break;

				case 'handle_denial':
					response = await this.handleDenial(context, conversation, intent);
					break;

				case 'handle_casual':
					response = await this.handleCasual(context, intent, conversation);
					break;

				case 'handle_get_assistant_name':
					response = await this.handleGetAssistantName(context);
					break;

				default:
					response = {
						message: 'Não entendi. Pode reformular? 😊',
						state: 'idle',
					};
			}
			const endAction = performance.now();
			loggers.ai.info({ action, duration: `${(endAction - startAction).toFixed(0)}*ms*` }, '✅ Ação finalizada');

			// BUILD ORCHESTRATION TRACE
			const totalMs = Math.round(performance.now() - startTotal);
			const trace: OrchestratorTrace = {
				intent: intent.intent,
				confidence: intent.confidence,
				action,
				llm_action: response.trace?.llm_action,
				tools_used: response.toolsUsed,
				schema_version: response.trace?.schema_version,
				durations: {
					intent_ms: Math.round(endIntent - startIntent),
					action_ms: Math.round(endAction - startAction),
					llm_ms: response.trace?.durations?.llm_ms,
					total_ms: totalMs,
				},
			};

			setAttributes({
				'orchestrator.intent': trace.intent,
				'orchestrator.confidence': trace.confidence,
				'orchestrator.action': trace.action,
				'orchestrator.llm_action': trace.llm_action ?? 'none',
				'orchestrator.tools_used': (trace.tools_used ?? []).join(','),
				'orchestrator.total_ms': totalMs,
			});

			try {
				setSentryContext('orchestration_trace', {
					intent: trace.intent,
					confidence: trace.confidence,
					action: trace.action,
					llm_action: trace.llm_action,
					tools_used: trace.tools_used,
					total_ms: totalMs,
				});
			} catch {
				/* Sentry opcional */
			}

			// 5. ATUALIZAR ESTADO
			await conversationService.updateState(conversation.id, response.state, {
				lastIntent: intent.intent,
				lastAction: action,
			});

			// 6. SALVAR MENSAGENS
			// Se a resposta for nula (ex: handleAmbiguousMessage), não salva resposta vazia
			// Mas a mensagem do user SEMPRE deve ser salva
			await conversationService.addMessage(
				conversation.id,
				'user',
				context.message,
				this.buildMessagePersistOptions(context, true),
			);
			if (response.message) {
				await conversationService.addMessage(
					conversation.id,
					'assistant',
					response.message,
					this.buildMessagePersistOptionsWithTrace(context, trace),
				);
			}

			// 7. AGENDAR FECHAMENTO SE A AÇÃO FINALIZOU
			// Fecha conversa em 3min se estado voltar para 'open' (idle)
			if (response.state === 'idle' && action !== 'handle_casual') {
				await scheduleConversationClose(conversation.id);
				loggers.ai.info({ conversationId: conversation.id }, '📅 Fechamento agendado');
			}

			loggers.ai.info({ charCount: response.message?.length || 0 }, '✅ Resposta gerada');
			return response;
		});
	}

	/**
	 * Decide qual ação tomar baseado em intenção + estado
	 */
	private async decideAction(intent: IntentResult, state: ConversationState): Promise<string> {
		const { CONVERSATION_FREE } = await getPivotFeatureFlags();
		return decideAgentAction(intent, state, CONVERSATION_FREE);
	}

	/**
	 * Delega para LLM (planner/writer)
	 *
	 * LLM retorna JSON seguindo AgentLLMResponse schema.
	 * Runtime processa e decide o que fazer.
	 */
	private async handleWithLLM(context: AgentContext, intent: IntentResult, conversation: any): Promise<AgentResponse> {
		return startSpan('agent.handle_with_llm', async (_span) => {
			const MAX_CONTRACT_RETRIES = 3;
			const toolContext: ToolContext = {
				userId: context.userId,
				conversationId: context.conversationId,
				provider: context.provider as 'telegram' | 'whatsapp' | 'discord',
				externalId: context.externalId,
			};

			// Busca tools disponíveis uma vez (usada tanto no gate quanto no prompt)
			const { tools: availableToolNames } = await toolAvailabilityService.getAvailableTools();

			// 🚨 GATE PRÉ-LLM: Detecta padrão de lembrete e clarifica ANTES de chamar LLM
			if (intent.entities?.reminderHint && conversation?.state === 'idle') {
				const hasReminder = availableToolNames.includes('schedule_reminder');
				const clarificationMsg = hasReminder
					? '📝 Salvar como nota ou ⏰ agendar um lembrete?'
					: '⏰ Lembretes precisam de integração com Google Calendar. Posso salvar como nota por enquanto. Confirma?';

				const buttons = hasReminder
					? [
							[
								{ text: '📝 Nota', callback_data: 'clarify_note' },
								{ text: '⏰ Lembrete', callback_data: 'clarify_reminder' },
							],
						]
					: [
							[
								{ text: '📝 Salvar nota', callback_data: 'clarify_note' },
								{ text: '❌ Cancelar', callback_data: 'clarify_cancel' },
							],
						];

				await conversationService.updateState(context.conversationId, 'awaiting_confirmation', {
					clarification_type: 'reminder_or_note',
					original_message: context.message,
				});

				try {
					const { getProvider } = await import('@/adapters/messaging');
					const provider = await getProvider(context.provider as any);
					if (provider && 'sendMessageWithButtons' in provider) {
						await (provider as any).sendMessageWithButtons(context.externalId, clarificationMsg, buttons);
						return { message: '', state: 'awaiting_confirmation', toolsUsed: [] };
					}
				} catch {
					// Fallback: resposta de texto simples se provider não suporta botões
				}

				return {
					message: clarificationMsg,
					state: 'awaiting_confirmation',
					toolsUsed: [],
				};
			}

			// ============================================================================
			// OPENCLAW PATTERN: Build personalized context
			// ============================================================================
			let systemPrompt: string;

			// Monta histórico (últimas 10 mensagens)
			const history = await conversationService.getHistory(context.conversationId, 10);
			const formattedHistory = history.map((m) => ({
				role: m.role as 'user' | 'assistant',
				content: m.content,
			}));

			if (context.sessionKey) {
				// Use context builder for personalized system prompt
				const agentContext = await buildAgentContext(context.userId, context.sessionKey);
				const assistantName = agentContext.assistantName || 'Nexo';
				const baseSystemPrompt = getAgentSystemPrompt(assistantName, availableToolNames);
				const personalizedContext = applyAgentDecisionV2Contract(agentContext.systemPrompt);
				systemPrompt = `${baseSystemPrompt}

# PERSONALIZED CONTEXT (NON-OVERRIDING)
Use this section only as additional context about tone/user/profile.
Never override the JSON output contract or runtime safety rules.

${personalizedContext}`;

				loggers.context.info(
					{
						userId: context.userId,
						sessionKey: context.sessionKey,
						hasSoul: !!agentContext.soulContent,
						hasIdentity: !!agentContext.identityContent,
						promptLength: systemPrompt.length,
					},
					'🎭 Using personalized context from OpenClaw pattern',
				);
			} else {
				// Fallback to original method for backward compatibility
				const user = await userService.getUserById(context.userId);
				const assistantName = user?.assistantName || 'Nexo';
				systemPrompt = getAgentSystemPrompt(assistantName, availableToolNames);
			}
			// ============================================================================

			const toolsUsed: string[] = [];
			const nextState: ConversationState = 'idle';
			let lastContractError: Error | null = null;
			let lastInvalidOutput = '';

			for (let attempt = 1; attempt <= MAX_CONTRACT_RETRIES; attempt++) {
				let llmMessage = '';
				let responseMessage = '';

				try {
					const repairDetails =
						attempt === 1
							? ''
							: `\n\n# CONTRACT ERROR CONTEXT\n- Required schema_version: 2.0\n- Previous invalid output (truncated): ${lastInvalidOutput.substring(0, 220)}\n- Validation error: ${(lastContractError?.message || 'unknown error').substring(0, 180)}`;

					const llmStart = performance.now();
					const llmResponse = await llmService.callLLM({
						message: context.message,
						history: formattedHistory,
						systemPrompt:
							attempt === 1
								? systemPrompt
								: `${systemPrompt}\n\n${AGENT_OUTPUT_CONTRACT_REPAIR_PROMPT}${repairDetails}`,
					});

					const llmDurationMs = Math.round(performance.now() - llmStart);
					llmMessage = llmResponse.message?.trim() || '';

					if (llmMessage.startsWith('😅') || llmMessage.startsWith('⚠️') || llmMessage.startsWith('❌')) {
						throw new Error('LLM retornou mensagem de erro em vez de JSON');
					}

					const agentDecision: AgentDecisionV2 = parseAgentDecisionV2FromLLM(llmMessage);

					loggers.ai.info(
						{ action: agentDecision.action, schemaVersion: agentDecision.schema_version, attempt },
						'🤖 LLM action (schema v2)',
					);

					switch (agentDecision.action) {
						case 'CALL_TOOL': {
							if (!agentDecision.tool_call) {
								throw new Error('action=CALL_TOOL requer tool_call');
							}

							const toolName = agentDecision.tool_call.name;
							const gateDecision = canExecuteAgentDecisionV2Tool(agentDecision);

							if (!gateDecision.allow) {
								loggers.ai.warn(
									{
										tool: toolName,
										action: agentDecision.action,
										deterministicPath: agentDecision.guardrails?.deterministic_path ?? null,
										gateReason: gateDecision.reason,
									},
									'⚠️ AgentDecisionV2 bloqueado pelo deterministic side-effect gate',
								);
								responseMessage =
									'⚠️ Por segurança, não executei essa ação automática. Pode confirmar de forma mais específica?';
								break;
							}

							loggers.ai.info({ tool: toolName }, '🔧 Executando tool');
							const result = await executeTool(toolName as any, toolContext, agentDecision.tool_call.arguments || {});

							toolsUsed.push(toolName);

							if (result.success) {
								if (result.data?.results && result.data.results.length > 0) {
									if (result.data.results.length === 1) {
										return await this.sendFinalConfirmation(context, conversation, result.data.results[0]);
									}
									return await this.sendCandidatesWithButtons(context, conversation, result.data.results);
								}
								if (result.message) {
									responseMessage = result.message || '';
								} else {
									responseMessage = getSuccessMessageForTool(toolName, result.data);
								}
							} else {
								loggers.ai.error({ tool: toolName, err: result.error }, '❌ Tool falhou (detalhes acima)');

								if (result.error === 'duplicate') {
									responseMessage = result.message || '⚠️ Este item já foi salvo anteriormente.';
								} else if (result.message) {
									responseMessage = result.message;
								} else {
									responseMessage = result.error || '❌ Ops, algo deu errado. Tenta de novo?';
								}
							}
							break;
						}

						case 'RESPOND':
							responseMessage = agentDecision.response?.text || 'Ok!';
							break;

						case 'NOOP':
							loggers.ai.info('🚫 NOOP - mensagem hostil/spam, ignorando silenciosamente');
							responseMessage = '';
							break;

						default:
							loggers.ai.error({ action: agentDecision.action }, '❌ Action desconhecida');
							responseMessage = 'Desculpe, não entendi o que fazer.';
					}
					return {
						message: responseMessage,
						state: nextState,
						toolsUsed,
						trace: {
							llm_action: agentDecision.action as 'CALL_TOOL' | 'RESPOND' | 'NOOP',
							schema_version: agentDecision.schema_version,
							durations: { llm_ms: llmDurationMs },
						},
					};
				} catch (parseError) {
					lastContractError = parseError instanceof Error ? parseError : new Error(String(parseError));
					lastInvalidOutput = llmMessage;

					loggers.ai.error(
						{
							err: lastContractError,
							attempt,
							maxAttempts: MAX_CONTRACT_RETRIES,
							originalMessage: llmMessage.substring(0, 200),
						},
						'❌ LLMParseError: falha ao parsear resposta do LLM como AgentLLMResponse',
					);

					if (attempt < MAX_CONTRACT_RETRIES) {
						loggers.ai.warn(
							{ attempt: attempt + 1, maxAttempts: MAX_CONTRACT_RETRIES },
							'🔁 Reenviando para LLM em modo de recuperação de contrato JSON',
						);
						continue;
					}

					return {
						message: 'Desculpe, tive um problema ao processar sua mensagem. Pode tentar de novo?',
						state: nextState,
						toolsUsed,
					};
				}
			}

			return {
				message: 'Desculpe, tive um problema ao processar sua mensagem. Pode tentar de novo?',
				state: nextState,
				toolsUsed,
			};
		});
	}

	/**
	 * Trata confirmação do usuário
	 */
	private async handleConfirmation(
		context: AgentContext,
		conversation: any,
		intent: IntentResult,
	): Promise<AgentResponse> {
		// Busca contexto anterior
		const contextData = conversation.context || {};

		// ─── Confirmação de delete destrutivo ───────────────────────────────
		if (contextData.pendingDelete) {
			const toolContext: ToolContext = {
				provider: context.provider as 'telegram' | 'whatsapp' | 'discord',
				externalId: context.externalId,
				userId: context.userId,
				conversationId: context.conversationId,
			};

			if (context.callbackData === 'confirm_delete_all' || intent.action === 'confirm') {
				const result = await executeTool('delete_all_memories', toolContext, {
					type: contextData.deleteType ?? undefined,
				});
				await conversationService.updateState(conversation.id, 'idle', {
					pendingDelete: null,
					deleteType: null,
					deleteCount: null,
				} as any);
				return {
					message: result.success
						? `✅ ${result.message || `${result.data?.deleted_count ?? 0} item(ns) apagado(s)`} com sucesso.`
						: '❌ Erro ao apagar itens. Tente novamente.',
					state: 'idle',
					toolsUsed: ['delete_all_memories'],
				};
			}

			if (context.callbackData === 'cancel_delete_all' || intent.action === 'deny') {
				await conversationService.updateState(conversation.id, 'idle', {
					pendingDelete: null,
					deleteType: null,
					deleteCount: null,
				} as any);
				return {
					message: '👍 Operação cancelada. Seus itens estão seguros!',
					state: 'idle',
				};
			}
		}
		// ────────────────────────────────────────────────────────────────────

		// DEBUG: Log para verificar callbackData
		loggers.ai.info(
			{ callbackData: context.callbackData, provider: context.provider, state: conversation.state },
			'🐛 [DEBUG] handleConfirmation',
		);

		// Se usuário clicou em botão de callback (Telegram inline button)
		// Formato: "select_N" onde N é o índice do candidato
		if (context.callbackData?.startsWith('select_')) {
			const index = Number.parseInt(context.callbackData.replace('select_', ''), 10);
			if (!Number.isNaN(index) && contextData.candidates && contextData.candidates[index]) {
				const selected = contextData.candidates[index];

				// STEP EXTRA: Enviar imagem + detalhes + confirmação final
				return await this.sendFinalConfirmation(context, conversation, selected);
			}
		}

		// Se usuário confirmou após ver imagem
		if (context.callbackData === 'confirm_final') {
			const selectedItem = contextData.selectedForConfirmation;
			if (!selectedItem) {
				return {
					message: '❌ Erro: item não encontrado. Por favor, tente novamente.',
					state: 'idle',
					toolsUsed: [],
				};
			}

			const toolContext: ToolContext = {
				userId: context.userId,
				conversationId: context.conversationId,
				provider: context.provider as 'telegram' | 'whatsapp' | 'discord',
				externalId: context.externalId,
			};

			const itemType = selectedItem.type || contextData.detected_type || 'note';

			let toolName: ToolName = 'save_note';
			if (itemType === 'movie') toolName = 'save_movie';
			else if (itemType === 'tv_show') toolName = 'save_tv_show';
			else if (itemType === 'video') toolName = 'save_video';
			else if (itemType === 'link') toolName = 'save_link';

			await executeTool(toolName as any, toolContext, {
				...selectedItem,
			});

			// Limpar contexto após salvar
			await conversationService.updateState(conversation.id, 'idle', {
				candidates: null,
				awaiting_selection: false,
				selectedForConfirmation: null,
			} as any);

			// Lista itens após salvar
			const listResult = await executeTool('search_items', toolContext, { limit: 5 });
			const itemsList =
				listResult.success && listResult.data?.length > 0
					? `\n\n📋 Últimos itens salvos:\n${listResult.data
							.map((item: any, i: number) => `${i + 1}. ${item.title || item.content?.substring(0, 50)}`)
							.join('\n')}`
					: '';

			return {
				message: `✅ ${selectedItem.title} salvo!${itemsList}`,
				state: 'idle',
				toolsUsed: [toolName],
			};
		}

		// Se usuário pediu para escolher novamente
		if (context.callbackData === 'choose_again') {
			// Mensagem aleatória de feedback (centralizada em config/prompts)
			const randomMsg = getRandomResponse(CHOOSE_AGAIN_MESSAGES);

			// Envia mensagem de feedback antes de mostrar a lista
			const { getProvider } = await import('@/adapters/messaging');
			const feedbackProvider = await getProvider(context.provider as any);
			if (feedbackProvider) {
				await feedbackProvider.sendMessage(context.externalId, randomMsg);
			}

			// Volta para lista de candidatos
			await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
				selectedForConfirmation: null,
			} as any);

			return await this.sendCandidatesWithButtons(context, conversation, contextData.candidates);
		}

		// Se há candidatos aguardando seleção (fallback texto)
		if (contextData.candidates && Array.isArray(contextData.candidates)) {
			const selection = intent.entities?.selection;

			if (typeof selection === 'number' && selection <= contextData.candidates.length) {
			}
		}

		// Se há forcedType (veio do fluxo de clarificação)
		if (contextData.forcedType && contextData.originalMessage) {
			const toolContext: ToolContext = {
				provider: context.provider as 'telegram' | 'whatsapp' | 'discord',
				externalId: context.externalId,
				userId: context.userId,
				conversationId: context.conversationId,
			};

			let toolName: ToolName = 'save_note';
			const params: any = {};

			// Mapeia tipo para tool apropriada
			switch (contextData.forcedType) {
				case 'note':
					toolName = 'save_note';
					params.content = contextData.originalMessage;
					break;
				case 'movie':
					toolName = 'save_movie';
					params.title = contextData.originalMessage;
					break;
				case 'series':
					toolName = 'save_tv_show';
					params.title = contextData.originalMessage;
					break;
				case 'link':
					toolName = 'save_link';
					params.url = contextData.originalMessage;
					break;
			}

			loggers.ai.info({ forcedType: contextData.forcedType, params }, '🔧 Salvando via forcedType');

			const result = await executeTool(toolName, toolContext, params);

			// Limpar contexto
			await conversationService.updateState(conversation.id, 'idle', {
				forcedType: null,
				originalMessage: null,
			} as any);

			if (result.success) {
				// Lista itens após salvar
				const listResult = await executeTool('search_items', toolContext, { limit: 5 });
				const itemsList =
					listResult.success && listResult.data?.length > 0
						? `\n\n📋 Últimos 5 itens salvos:\n${listResult.data
								.map((item: any, i: number) => `${i + 1}. ${item.title || item.content?.substring(0, 50)}`)
								.join('\n')}`
						: '';

				return {
					message: result.message || `✅ Salvei!${itemsList}`,
					state: 'idle',
					toolsUsed: [toolName],
				};
			}
			return {
				message: result.message || '❌ Ops, algo deu errado.',
				state: 'idle',
			};
		}

		// Confirmação genérica (fallback)
		const confirmMsg = confirmationMessages[Math.floor(Math.random() * confirmationMessages.length)].replace(
			'{type}',
			'item',
		);
		return {
			message: confirmMsg,
			state: 'idle',
		};
	}

	/**
	 * Trata negação do usuário
	 */
	private async handleDenial(_context: AgentContext, conversation: any, _intent: IntentResult): Promise<AgentResponse> {
		// Limpar candidatos do contexto se houver
		await conversationService.updateState(conversation.id, 'idle', {
			candidates: null,
			awaiting_selection: false,
		} as any);

		return {
			message: CANCELLATION_PROMPT,
			state: 'idle',
		};
	}

	/**
	 * Salva mensagem anterior quando usuário diz "salva ai", "guarda isso"
	 */
	private async handleSavePrevious(context: AgentContext, _conversation: any): Promise<AgentResponse> {
		// Busca últimas mensagens (exclui a atual que é o pedido para salvar)
		const history = await conversationService.getHistory(context.conversationId, 10);

		// Pega a penúltima mensagem do usuário (última antes de "salva ai")
		const userMessages = history.filter((m) => m.role === 'user');

		if (userMessages.length < 2) {
			return {
				message: 'Não tenho nenhuma mensagem anterior para salvar.',
				state: 'idle',
			};
		}

		// Pega a mensagem anterior (penúltima)
		const previousMessage = userMessages[userMessages.length - 2];
		const contentToSave = previousMessage.content;

		// Salva como nota
		const toolContext: ToolContext = {
			provider: context.provider as 'telegram' | 'whatsapp' | 'discord',
			externalId: context.externalId,
			userId: context.userId,
			conversationId: context.conversationId,
		};

		const result = await executeTool('save_note', toolContext, {
			content: contentToSave,
		});

		if (result.success) {
			return {
				message: SAVE_SUCCESS('✅ Salvei!'),
				state: 'idle',
				toolsUsed: ['save_note'],
			};
		}
		return {
			message: getRandomResponse(ERROR_MESSAGES),
			state: 'idle',
		};
	}

	/**
	 * Trata conversa casual (sem LLM) com respostas contextuais
	 */
	private async handleCasual(context: AgentContext, intent: IntentResult, _conversation: any): Promise<AgentResponse> {
		const msg = context.message.toLowerCase().trim();
		let response: string;

		// 1. Tenta mapeamento direto primeiro (mais rápido)
		if (CASUAL_GREETINGS[msg]) {
			response = CASUAL_GREETINGS[msg];
		}
		// 2. Usa action do intent para escolher categoria
		else if (intent.action === 'thank') {
			// Agradecimento: verifica se acabou de executar algo
			const { CASUAL_RESPONSES } = await import('@/config/prompts');
			const history = await conversationService.getHistory(context.conversationId, 3);
			const lastAssistantMsg = history.find((m) => m.role === 'assistant');

			// Se última mensagem do bot foi confirmação de ação, usa resposta casual
			if (lastAssistantMsg?.content.includes('✅') || lastAssistantMsg?.content.includes('salvo')) {
				response = CASUAL_RESPONSES.thanks[Math.floor(Math.random() * CASUAL_RESPONSES.thanks.length)];
			} else {
				response = 'De nada! 😊'; // Fallback neutro
			}
		} else if (intent.action === 'greet') {
			const { CASUAL_RESPONSES } = await import('@/config/prompts');
			response = CASUAL_RESPONSES.greetings[Math.floor(Math.random() * CASUAL_RESPONSES.greetings.length)];
		} else {
			// Fallback genérico
			response = 'Oi! 👋';
		}

		return {
			message: response,
			state: 'idle',
		};
	}

	/**
	 * Responde com o nome do assistente (customizado ou default)
	 */
	private async handleGetAssistantName(context: AgentContext): Promise<AgentResponse> {
		const toolContext: ToolContext = {
			provider: context.provider as 'telegram' | 'whatsapp' | 'discord',
			externalId: context.externalId,
			userId: context.userId,
			conversationId: context.conversationId,
		};

		const result = await executeTool('get_assistant_name', toolContext, {});
		const name = result.data?.name || 'Nexo';

		return {
			message: `Meu nome é ${name}! 😊`,
			state: 'idle',
			toolsUsed: ['get_assistant_name'],
		};
	}

	/**
	 * Handler: Busca/Listagem (determinístico, sem LLM)
	 */
	private async handleSearch(context: AgentContext, intent: IntentResult): Promise<AgentResponse> {
		const toolContext: ToolContext = {
			provider: context.provider as 'telegram' | 'whatsapp' | 'discord',
			externalId: context.externalId,
			userId: context.userId,
			conversationId: context.conversationId,
		};

		// Para list_all não passar query (evita busca semântica que pode falhar)
		const isListAll = intent.action === 'list_all';
		const searchQuery = isListAll ? undefined : intent.entities?.query;

		const result = await executeTool('search_items', toolContext, {
			query: searchQuery,
			limit: 10,
		});

		if (result.success && result.data) {
			// Usa countItems para o total real do banco (não items.length que pode ser limitado ou filtrado)
			const totalCount = await itemService.countItems(context.userId);
			if (totalCount === 0) {
				return {
					message: NO_ITEMS_FOUND,
					state: 'idle',
					toolsUsed: ['search_items'],
				};
			}

			// Se a busca retornou vazio mas existem itens, busca sem filtro como fallback
			const itemsToShow =
				result.data.items?.length > 0
					? result.data.items
					: ((await executeTool('search_items', toolContext, { limit: 10 })).data?.items ?? []);

			const message = formatItemsList(itemsToShow, totalCount);

			return {
				message,
				state: 'idle',
				toolsUsed: ['search_items'],
			};
		}

		// Erro na busca
		return {
			message: 'Erro ao buscar itens. Tente novamente.',
			state: 'idle',
		};
	}

	/**
	 * Handler: Deletar TUDO (determinístico, sem LLM)
	 * Pede confirmação antes de executar ação destrutiva irreversível
	 */
	private async handleDeleteAll(
		context: AgentContext,
		intent: IntentResult,
		conversation: any,
	): Promise<AgentResponse> {
		const deleteType = intent.entities?.itemType ?? undefined;

		// 1. Contar itens afetados para informar o usuário
		const count = await itemService.countItems(context.userId, deleteType);

		if (count === 0) {
			const typeLabel = deleteType
				? `${deleteType === 'movie' ? 'filmes' : deleteType === 'tv_show' ? 'séries' : deleteType === 'note' ? 'notas' : deleteType === 'link' ? 'links' : deleteType}`
				: 'itens';
			return {
				message: `Não há ${typeLabel} para apagar. 🤷`,
				state: 'idle',
			};
		}

		// 2. Perguntar confirmação antes de deletar (ação irreversível)
		const typeLabel = deleteType
			? `${count} ${deleteType === 'movie' ? (count === 1 ? 'filme' : 'filmes') : deleteType === 'tv_show' ? (count === 1 ? 'série' : 'séries') : deleteType === 'note' ? (count === 1 ? 'nota' : 'notas') : deleteType === 'link' ? (count === 1 ? 'link' : 'links') : deleteType}`
			: `${count} ${count === 1 ? 'item' : 'itens'}`;

		const warningMsg = `⚠️ Você está prestes a apagar *${typeLabel}*. Essa ação é irreversível!\n\nTem certeza?`;

		// Salva contexto para execução após confirmação
		if (conversation) {
			await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
				pendingDelete: true,
				deleteType: deleteType ?? null,
				deleteCount: count,
			} as any);
		}

		const confirmButtons = [
			[
				{ text: '✅ Sim, apagar tudo', callback_data: 'confirm_delete_all' },
				{ text: '❌ Cancelar', callback_data: 'cancel_delete_all' },
			],
		];

		const { getProvider } = await import('@/adapters/messaging');
		const provider = await getProvider(context.provider as any);

		if (provider && 'sendMessageWithButtons' in provider) {
			await (provider as any).sendMessageWithButtons(context.externalId, warningMsg, confirmButtons);
			return {
				message: '',
				state: 'awaiting_confirmation',
				toolsUsed: [],
				skipFallback: true,
			};
		}

		// Fallback: texto simples
		return {
			message: warningMsg,
			state: 'awaiting_confirmation',
			toolsUsed: [],
		};
	}

	/**
	 * Handler: Deletar item específico (determinístico)
	 */
	private async handleDeleteItem(context: AgentContext, intent: IntentResult): Promise<AgentResponse> {
		const toolContext: ToolContext = {
			provider: context.provider as 'telegram' | 'whatsapp' | 'discord',
			externalId: context.externalId,
			userId: context.userId,
			conversationId: context.conversationId,
		};

		// Se tem selection (número ou array), busca primeiro para pegar IDs
		if (intent.entities?.selection) {
			const selections = Array.isArray(intent.entities.selection)
				? intent.entities.selection
				: [intent.entities.selection];

			// Buscar lista para pegar os itens
			const searchResult = await executeTool('search_items', toolContext, {
				limit: 50,
			});

			if (searchResult.success && searchResult.data) {
				const items = searchResult.data.items;
				const deletedItems: string[] = [];
				const notFoundSelections: number[] = [];

				// Filtra por tipo se especificado (ex: "deleta o filme 1" → filtra apenas filmes)
				const targetItems = intent.entities?.itemType
					? items.filter((i: any) => i.type === intent.entities?.itemType)
					: items;

				// Processar cada seleção
				for (const selection of selections) {
					const index = selection - 1;

					if (index >= 0 && index < targetItems.length) {
						const itemToDelete = targetItems[index];

						// Deletar o item
						const deleteResult = await executeTool('delete_memory', toolContext, {
							item_id: itemToDelete.id,
						});

						if (deleteResult.success) {
							deletedItems.push(itemToDelete.title);
						}
					} else {
						notFoundSelections.push(selection);
					}
				}

				// Montar resposta
				if (deletedItems.length > 0) {
					const itemsList = deletedItems.map((title) => `"${title}"`).join(', ');
					let message = `✅ ${deletedItems.length} item(ns) deletado(s): ${itemsList}`;

					if (notFoundSelections.length > 0) {
						message += `\n⚠️ Não encontrado(s): ${notFoundSelections.join(', ')}`;
					}

					return {
						message,
						state: 'idle',
						toolsUsed: ['search_items', 'delete_memory'],
					};
				}

				return {
					message: `Item(ns) ${notFoundSelections.join(', ')} não encontrado(s). Você tem ${items.length} item(ns) salvos.`,
					state: 'idle',
				};
			}
		}

		// Se tem query, buscar e pedir confirmação
		if (intent.entities?.query) {
			return {
				message: `Quer deletar itens relacionados a "${intent.entities.query}"? Responda com "sim" ou "não".`,
				state: 'awaiting_confirmation',
			};
		}

		// Sem informação suficiente
		return {
			message: 'Qual item você quer deletar? Diga o número ou o nome.',
			state: 'idle',
		};
	}

	/**
	 * Executa ação direta (DEPRECATED - usar handleSearch)
	 */
	private async handleDirect(context: AgentContext, intent: IntentResult): Promise<AgentResponse> {
		return this.handleSearch(context, intent);
	}

	/**
	 * Handler para resposta de clarificação (estado awaiting_context)
	 * Processa escolha do usuário e prossegue para ação apropriada
	 */
	private async handleClarificationResponse(context: AgentContext, conversation: any): Promise<AgentResponse> {
		const { pendingClarification } = conversation.context || {};

		if (!pendingClarification) {
			loggers.ai.warn('⚠️ Nenhuma clarificação pendente');
			return {
				message: 'Desculpe, não entendi. O que você precisa?',
				state: 'idle',
			};
		}

		loggers.ai.info('🔍 Processando resposta de clarificação');

		// Mapeia escolha do usuário (1-5 ou linguagem natural)
		const message = context.message.trim();

		// Verifica se usuário mudou de contexto (pergunta ou comando ao invés de número/clarificação)
		const isNumber = /^\d+$/.test(message);
		const tone = messageAnalyzer.checkTone(message);

		if (!isNumber && (tone.isQuestion || tone.tone === 'imperative')) {
			loggers.ai.info({ message }, '↩️ Usuário mudou de contexto durante clarificação - reprocessando');

			// 1. Reseta estado no banco para sair do loop
			await conversationService.updateState(conversation.id, 'idle', {
				pendingClarification: undefined,
			});

			// 2. Atualiza objeto local para reprocessamento
			conversation.state = 'idle';
			delete conversation.context?.pendingClarification;

			// 3. Reprocessa mensagem como fluxo normal
			return this.processMessage(context);
		}

		const choice = Number.parseInt(message);
		let detectedType: string | null = null;

		// 🧠 Usa NLP para detectar resposta em linguagem natural
		// Exemplos: "é um filme", "anota ai", "to falando da série", "quero como link"
		if (!isNumber || Number.isNaN(choice)) {
			try {
				const nlpResult = await messageAnalyzer.classifyIntent(message);
				loggers.ai.info(
					{ intent: nlpResult.intent, confidence: nlpResult.confidence, action: nlpResult.action },
					'🧠 NLP Classification',
				);

				// Mapeamento de intents para tipos
				const intentToType: Record<string, string> = {
					'clarification.note': 'note',
					'clarification.movie': 'movie',
					'clarification.tv_show': 'series',
					'clarification.link': 'link',
				};

				if (nlpResult.intent in intentToType && nlpResult.confidence > 0.6) {
					detectedType = intentToType[nlpResult.intent];
					const typeEmoji: Record<string, string> = {
						note: '📝',
						movie: '🎬',
						series: '📺',
						link: '🔗',
					};
					loggers.ai.info(
						{ message, detectedType, confidence: nlpResult.confidence },
						`${typeEmoji[detectedType]} Tipo detectado via NLP`,
					);
				}
			} catch (error) {
				loggers.ai.warn({ error }, '⚠️ Erro ao classificar via NLP, tentando fallback');
			}
		}

		// Se não detectou via NLP, tenta números — mapeamento dinâmico baseado nas tools habilitadas
		if (!detectedType && isNumber && !Number.isNaN(choice)) {
			const { toolService } = await import('@/services/tools/tool.service');
			const saveTools = await toolService.getSaveTools();

			// Mapa tool name → tipo interno
			const toolToType: Record<string, string> = {
				save_note: 'note',
				save_movie: 'movie',
				save_tv_show: 'series',
				save_video: 'video',
				save_link: 'link',
			};

			const cancelIndex = saveTools.length + 1; // última opção é sempre cancelar

			if (choice === cancelIndex) {
				loggers.ai.info({ choice }, '❌ Usuário cancelou clarificação');
				await conversationService.updateState(conversation.id, 'idle', {
					pendingClarification: undefined,
				});
				return {
					message: getRandomMessage(cancellationMessages),
					state: 'idle',
				};
			}
			if (choice >= 1 && choice <= saveTools.length) {
				const selectedTool = saveTools[choice - 1];
				detectedType = toolToType[selectedTool.name] ?? null;

				if (detectedType) {
					loggers.ai.info({ choice, tool: selectedTool.name, detectedType }, '✅ Tipo detectado via seleção dinâmica');
				}
			} else {
				// Número fora do range — reprocessa como nova mensagem
				loggers.ai.info(
					{ message, choice, totalOptions: cancelIndex },
					'↩️ Número fora do range - reprocessando como nova mensagem',
				);

				await conversationService.updateState(conversation.id, 'idle', {
					pendingClarification: undefined,
				});

				conversation.state = 'idle';
				delete conversation.context?.pendingClarification;

				return this.processMessage(context);
			}
		}

		// Se nem NLP nem número detectaram tipo válido, reprocessa como nova mensagem
		if (!detectedType) {
			loggers.ai.info({ message }, '↩️ Nenhum tipo detectado - reprocessando como nova mensagem');

			// Reseta estado e reprocessa
			await conversationService.updateState(conversation.id, 'idle', {
				pendingClarification: undefined,
			});

			conversation.state = 'idle';
			delete conversation.context?.pendingClarification;

			return this.processMessage(context);
		}

		// ✅ Tipo detectado (via NLP ou número)! Continua o fluxo...
		loggers.ai.info({ detectedType }, '✅ Tipo escolhido pelo usuário');

		const originalMessage = pendingClarification.originalMessage;

		// Resetar tentativas de clarificação se teve sucesso
		await conversationService.updateState(conversation.id, 'processing', {
			clarificationAttempts: 0,
		});

		const toolContext: ToolContext = {
			provider: context.provider as 'telegram' | 'whatsapp' | 'discord',
			externalId: context.externalId,
			userId: context.userId,
			conversationId: context.conversationId,
		};

		// Limpa a clarificação pendente
		await conversationService.updateState(conversation.id, 'processing', {
			pendingClarification: undefined,
		});

		// 🎬 Para FILME ou SÉRIE: Buscar no TMDB e mostrar opções
		if (detectedType === 'movie' || detectedType === 'series') {
			const searchTool = detectedType === 'movie' ? 'enrich_movie' : 'enrich_tv_show';
			const itemType = detectedType === 'movie' ? 'movie' : 'tv_show';

			loggers.ai.info({ originalMessage, searchTool }, '🔍 Buscando no TMDB...');

			const enrichResult = await executeTool(searchTool, toolContext, {
				title: originalMessage,
			});

			if (enrichResult.success && enrichResult.data?.results?.length > 0) {
				// Mapeia resultados para o formato esperado por sendCandidatesWithButtons
				const candidates = enrichResult.data.results.map((r: any) => ({
					...r,
					type: itemType,
					year: r.year,
					genres: r.genres || [],
					poster_path: r.poster_path,
				}));

				// Atualiza contexto com candidatos
				await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
					candidates,
					detected_type: itemType,
					originalMessage,
				});

				// Envia lista com botões
				return await this.sendCandidatesWithButtons(context, conversation, candidates);
			}
			// Não encontrou no TMDB - salva apenas com título
			loggers.ai.warn({ originalMessage }, '⚠️ Nenhum resultado no TMDB, salvando apenas com título');

			const saveToolName = detectedType === 'movie' ? 'save_movie' : 'save_tv_show';
			const result = await executeTool(saveToolName, toolContext, {
				title: originalMessage,
			});

			await conversationService.updateState(conversation.id, 'idle', {});

			if (result.success) {
				return {
					message: `✅ Salvei "${originalMessage}" como ${detectedType === 'movie' ? 'filme' : 'série'}! (Não encontrei no TMDB para enriquecer)`,
					state: 'idle',
					toolsUsed: [saveToolName],
				};
			}
			return {
				message: result.error || '❌ Ops, algo deu errado ao salvar.',
				state: 'idle',
			};
		}

		// 📝 Para NOTA: Salva direto
		if (detectedType === 'note') {
			const result = await executeTool('save_note', toolContext, {
				content: originalMessage,
			});

			await conversationService.updateState(conversation.id, 'idle', {});

			if (result.success) {
				return {
					message: '✅ Nota salva!',
					state: 'idle',
					toolsUsed: ['save_note'],
				};
			}
			return {
				message: result.error || '❌ Ops, algo deu errado ao salvar.',
				state: 'idle',
			};
		}

		// 🔗 Para LINK: Salva direto
		if (detectedType === 'link') {
			const result = await executeTool('save_link', toolContext, {
				url: originalMessage,
			});

			await conversationService.updateState(conversation.id, 'idle', {});

			if (result.success) {
				return {
					message: '✅ Link salvo!',
					state: 'idle',
					toolsUsed: ['save_link'],
				};
			}
			return {
				message: result.error || '❌ Ops, algo deu errado ao salvar.',
				state: 'idle',
			};
		}

		// Fallback: tipo desconhecido - CONVERSA LIVRE OU OFF-TOPIC
		const attempts = (conversation.context?.clarificationAttempts || 0) + 1;

		if (attempts >= this.MAX_CLARIFICATION_ATTEMPTS) {
			loggers.ai.info({ attempts }, '🛑 Limite de clarificações atingido, entrando em off_topic');

			const { OFF_TOPIC_MESSAGES, getRandomMessage } = await import('@/config/prompts');
			const offTopicMessage = getRandomMessage(OFF_TOPIC_MESSAGES);

			await conversationService.updateState(conversation.id, 'off_topic_chat', {
				clarificationAttempts: attempts,
				lastClarificationMessage: pendingClarification.originalMessage,
				pendingClarification: undefined, // Limpa para não entrar em loop
			});

			await conversationService.addMessage(
				conversation.id,
				'user',
				context.message,
				this.buildMessagePersistOptions(context, true),
			);
			await conversationService.addMessage(
				conversation.id,
				'assistant',
				offTopicMessage,
				this.buildMessagePersistOptions(context),
			);

			return {
				message: offTopicMessage,
				state: 'off_topic_chat',
				skipFallback: true,
			};
		}

		// Conversa livre com IA
		loggers.ai.info({ attempts }, '💬 NLP inconclusivo, gerando resposta conversacional via IA');

		const conversationalResponse = await this.getConversationalClarification(
			context,
			pendingClarification.originalMessage,
			attempts,
		);

		await conversationService.updateState(conversation.id, 'awaiting_context', {
			clarificationAttempts: attempts,
		});

		await conversationService.addMessage(
			conversation.id,
			'user',
			context.message,
			this.buildMessagePersistOptions(context, true),
		);
		await conversationService.addMessage(
			conversation.id,
			'assistant',
			conversationalResponse,
			this.buildMessagePersistOptions(context),
		);

		return {
			message: conversationalResponse,
			state: 'awaiting_context',
			skipFallback: true,
		};
	}

	/**
	 * Gera resposta conversacional durante clarificação usando LLM
	 */
	private async getConversationalClarification(
		context: AgentContext,
		originalMessage: string,
		attempt: number,
	): Promise<string> {
		const { CLARIFICATION_CONVERSATIONAL_PROMPT } = await import('@/config/prompts');

		const prompt = CLARIFICATION_CONVERSATIONAL_PROMPT.replace('{original_message}', originalMessage)
			.replace('{user_response}', context.message)
			.replace('{attempt}', String(attempt))
			.replace('{max_attempts}', String(this.MAX_CLARIFICATION_ATTEMPTS));

		const response = await llmService.callLLM({
			message: context.message,
			systemPrompt: prompt,
			history: [],
		});

		return response.message || 'Desculpa, não entendi bem. O que você gostaria de fazer com isso?';
	}

	/**
	 * Envia lista de candidatos com botões clicáveis (Telegram Inline Keyboard)

	 */
	private async sendCandidatesWithButtons(
		context: AgentContext,
		conversation: any,
		candidates: any[],
	): Promise<AgentResponse> {
		const contextData = conversation.context || {};
		const itemType = contextData.detected_type || 'movie';

		// Limita para 7 candidatos (melhor UX)
		const limitedCandidates = candidates.slice(0, 7);

		// Monta mensagem com descrição + gêneros (texto diferente para 1 ou múltiplos)
		const itemTypePt = itemType === 'movie' ? 'filme' : 'série';
		const itemTypePtPlural = itemType === 'movie' ? 'filmes' : 'séries';
		let message =
			limitedCandidates.length === 1
				? `🎬 Encontrei este ${itemTypePt}. É esse que você quer?\n\n`
				: `🎬 Encontrei ${limitedCandidates.length} ${itemTypePtPlural}. Qual você quer salvar?\n_Selecione para ver mais detalhes._\n\n`;

		limitedCandidates.forEach((candidate: any, index: number) => {
			const year = candidate.year || candidate.release_date?.split('-')[0] || '';
			const overview = candidate.overview || '';
			// Limita sinopse a 85 caracteres para lista mais limpa
			const overviewSnippet = overview.length > 85 ? `${overview.substring(0, 85)}...` : overview;

			message += `${index + 1}. *${candidate.title}* (${year})\n`;
			if (overviewSnippet) message += `   ${overviewSnippet}\n`;
			message += '\n';
		});

		// Salva no contexto para uso posterior (candidatos limitados)
		await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
			candidates: limitedCandidates,
			detected_type: itemType,
		});

		// Se provider suporta botões, envia com botões inline/numerados
		const candidateButtons = limitedCandidates.map((_: any, index: number) => ({
			text: `${index + 1}`,
			callback_data: `select_${index}`,
		}));

		// Agrupa em linhas de 3 botões cada
		const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
		for (let i = 0; i < candidateButtons.length; i += 3) {
			buttons.push(candidateButtons.slice(i, i + 3));
		}

		const { getProvider } = await import('@/adapters/messaging');
		const provider = await getProvider(context.provider as any);

		if (provider && 'sendMessageWithButtons' in provider) {
			await (provider as any).sendMessageWithButtons(context.externalId, message, buttons);

			return {
				message: '',
				state: 'awaiting_confirmation',
				toolsUsed: [],
				skipFallback: true,
			};
		}

		// Fallback: mensagem texto simples
		return {
			message,
			state: 'awaiting_confirmation',
			toolsUsed: [],
		};
	}

	/**
	 * Envia confirmação final com imagem + detalhes + botões
	 */
	private async sendFinalConfirmation(context: AgentContext, conversation: any, selected: any): Promise<AgentResponse> {
		// DEBUG: Log do item selecionado
		loggers.ai.info(
			{
				title: selected.title,
				poster_path: selected.poster_path,
				poster_url: selected.poster_url,
				type: selected.type,
			},
			'🎬 [DEBUG] sendFinalConfirmation - item selecionado',
		);

		const itemType = selected.type || 'movie';
		const year = selected.year || selected.release_date?.split('-')[0] || '';
		const genres = selected.genres?.join(', ') || '';
		const overview = selected.overview || 'Sem descrição disponível.';
		const rating = selected.vote_average ? `⭐ ${selected.vote_average.toFixed(1)}/10` : '';

		// Corrige posterUrl: usa poster_url OU constrói a partir de poster_path
		let posterUrl: string | null = null;
		if (selected.poster_url) {
			posterUrl = selected.poster_url;
		} else if (selected.poster_path) {
			posterUrl = `https://image.tmdb.org/t/p/w500${selected.poster_path}`;
		}

		// Monta caption com rating e overview completo
		let caption = `🎬 *${selected.title}* (${year})\n`;
		if (rating) caption += `${rating}\n`;
		if (genres) caption += `📁 Gêneros: ${genres}\n`;
		caption += `\n📝 ${overview}\n\n`;
		caption += `É esse ${itemType === 'movie' ? 'filme' : 'série'}?`;

		// Salva item no contexto para confirmação final
		await conversationService.updateState(conversation.id, 'awaiting_final_confirmation', {
			selectedForConfirmation: selected,
		});

		const confirmButtons = [
			[
				{ text: '✅ É esse mesmo!', callback_data: 'confirm_final' },
				{ text: '🔄 Escolher novamente', callback_data: 'choose_again' },
			],
		];

		// Obtém provider dinamicamente do contexto
		const { getProvider } = await import('@/adapters/messaging');
		const provider = await getProvider(context.provider as any);

		// Se tiver poster E provider suporta sendPhoto → envia foto com botões
		if (posterUrl && provider && 'sendPhoto' in provider) {
			loggers.ai.info({ posterUrl, title: selected.title, provider: context.provider }, '🖼️ Enviando foto do TMDB');
			if ('sendChatAction' in provider) {
				await (provider as any).sendChatAction(context.externalId, 'upload_photo');
			}
			await (provider as any).sendPhoto(context.externalId, posterUrl, caption, confirmButtons);

			return {
				message: '',
				state: 'awaiting_final_confirmation',
				toolsUsed: [],
				skipFallback: true,
			};
		}

		// Sem poster mas provider suporta botões → envia texto com botões
		if (provider && 'sendMessageWithButtons' in provider) {
			await (provider as any).sendMessageWithButtons(context.externalId, caption, confirmButtons);

			return {
				message: '',
				state: 'awaiting_final_confirmation',
				toolsUsed: [],
				skipFallback: true,
			};
		}

		// Provider não suporta botões → envia mensagem de texto simples
		return {
			message: caption,
			state: 'awaiting_final_confirmation',
			toolsUsed: [],
		};
	}
}

/**
 * Gera mensagem amigável baseada na tool executada
 */
function getSuccessMessageForTool(tool: string, data?: any): string {
	switch (tool) {
		case 'save_note':
			return '✅ Nota salva!';
		case 'save_movie':
			return '✅ Filme salvo!';
		case 'save_tv_show':
			return '✅ Série salva!';
		case 'save_video':
			return '✅ Vídeo salvo!';
		case 'save_link':
			return '✅ Link salvo!';
		case 'search_items': {
			const count = data?.count || 0;
			if (count === 0) {
				return 'Não encontrei nada 😕';
			}
			return formatItemsList(data.items, count);
		}
		case 'delete_memory':
			return '✅ Item deletado!';
		case 'delete_all_memories': {
			const deleted = data?.deleted_count || 0;
			return deleted > 0 ? `✅ ${deleted} item(ns) deletado(s)` : 'Nada para deletar';
		}
		default:
			return '✅ Feito!';
	}
}

// Singleton
export const agentOrchestrator = instrumentService('agentOrchestrator', new AgentOrchestrator());
