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

import { intentClassifier, type IntentResult, type UserIntent } from './intent-classifier';
import { conversationService } from './conversation-service';
import { userService } from '@/services/user-service';
import { llmService } from './ai';
import { executeTool, type ToolContext, type ToolOutput } from './tools';
import { messageAnalyzer } from '@/services/message-analysis/message-analyzer.service';
import {
	AGENT_SYSTEM_PROMPT,
	CASUAL_GREETINGS,
	GENERIC_CONFIRMATION,
	CANCELLATION_PROMPT,
	NO_ITEMS_FOUND,
	SAVE_SUCCESS,
	ERROR_MESSAGES,
	FALLBACK_MESSAGES,
	getRandomMessage as getRandomResponse,
	formatItemsList,
} from '@/config/prompts';
import { loggers, logError } from '@/utils/logger';
import type { ConversationState, AgentLLMResponse, ToolName } from '@/types';
import { parseJSONFromLLM, isValidAgentResponse } from '@/utils/json-parser';
import { scheduleConversationClose } from './queue-service';
import {
	confirmationMessages,
	enrichmentMessages,
	cancellationMessages,
	clarificationOptions,
	getRandomMessage,
} from './conversation/messageTemplates';

export interface AgentContext {
	userId: string;
	conversationId: string;
	externalId: string;
	message: string;
	// Telegram callback data
	callbackData?: string;
	provider: string; // Provider sempre obrigatório (vem do webhook)
}

export interface AgentResponse {
	message: string;
	state: ConversationState;
	toolsUsed?: string[];
	skipFallback?: boolean; // Flag para não enviar fallback quando já enviou manualmente
}

/**
 * Orquestrador principal do agente
 */
export class AgentOrchestrator {
	/**
	 * Processa mensagem do usuário
	 */
	async processMessage(context: AgentContext): Promise<AgentResponse> {
		loggers.ai.info({ message: context.message }, '🎯 Processando mensagem');

		// 0. BUSCAR ESTADO ATUAL
		const conversation = await conversationService.findOrCreateConversation(context.userId);
		loggers.ai.info({ state: conversation.state }, '📊 Estado atual');

		// A. TRATAR ESTADO AWAITING_CONTEXT (Clarificação)
		if (conversation.state === 'awaiting_context') {
			return this.handleClarificationResponse(context, conversation);
		}

		// B. TRATAR CALLBACKS DO TELEGRAM (botões inline)
		// Quando há callbackData, são comandos internos do bot - não classificar via NLP
		if (context.callbackData) {
			const cb = context.callbackData;
			const isKnownCallback = cb.startsWith('select_') || cb === 'confirm_final' || cb === 'choose_again';

			if (isKnownCallback && (conversation.state === 'awaiting_confirmation' || conversation.state === 'awaiting_final_confirmation')) {
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

		// 1. CLASSIFICAR INTENÇÃO (determinístico)
		const startIntent = performance.now();
		const intent = await intentClassifier.classify(context.message);
		const endIntent = performance.now();
		loggers.ai.info(
			{ intent: intent.intent, confidence: intent.confidence, duration: `${(endIntent - startIntent).toFixed(0)}*ms*` },
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
				loggers.ai.info({ duration: `${(endAmbiguous - startAmbiguous).toFixed(0)}*ms*` }, '🔍 Ambiguidade detectada');
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
		const action = this.decideAction(intent, conversation.state);

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
				response = await this.handleDeleteAll(context);
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

		// 5. ATUALIZAR ESTADO
		await conversationService.updateState(conversation.id, response.state, {
			lastIntent: intent.intent,
			lastAction: action,
		});

		// 6. SALVAR MENSAGENS
		// Se a resposta for nula (ex: handleAmbiguousMessage), não salva resposta vazia
		// Mas a mensagem do user SEMPRE deve ser salva
		await conversationService.addMessage(conversation.id, 'user', context.message);
		if (response.message) {
			await conversationService.addMessage(conversation.id, 'assistant', response.message);
		}

		// 7. AGENDAR FECHAMENTO SE A AÇÃO FINALIZOU
		// Fecha conversa em 3min se estado voltar para 'open' (idle)
		if (response.state === 'idle' && action !== 'handle_casual') {
			await scheduleConversationClose(conversation.id);
			loggers.ai.info({ conversationId: conversation.id }, '📅 Fechamento agendado');
		}

		loggers.ai.info({ charCount: response.message?.length || 0 }, '✅ Resposta gerada');
		return response;
	}

	/**
	 * Decide qual ação tomar baseado em intenção + estado
	 */
	private decideAction(intent: IntentResult, state: ConversationState): string {
		// Confirmação/Negação só importam se estamos aguardando
		if (state === 'awaiting_confirmation' || state === 'awaiting_final_confirmation') {
			if (intent.action === 'confirm') return 'handle_confirmation';
			if (intent.action === 'deny') return 'handle_denial';
		}

		// AÇÕES DETERMINÍSTICAS (execução direta, sem LLM)
		switch (intent.action) {
			case 'delete_all':
				return 'handle_delete_all';
			case 'delete_item':
			case 'delete_selected':
				return 'handle_delete_item';
			case 'list_all':
			case 'search':
				return 'handle_search';
			case 'save_previous':
				return 'handle_save_previous';
			case 'greet':
			case 'thank':
				return 'handle_casual';
			case 'get_assistant_name':
				return 'handle_get_assistant_name';
		}

		// Resto: delega para LLM
		return 'handle_with_llm';
	}

	/**
	 * Delega para LLM (planner/writer)
	 *
	 * LLM retorna JSON seguindo AgentLLMResponse schema.
	 * Runtime processa e decide o que fazer.
	 */
	private async handleWithLLM(context: AgentContext, intent: IntentResult, conversation: any): Promise<AgentResponse> {
		const toolContext: ToolContext = {
			userId: context.userId,
			conversationId: context.conversationId,
		};

		// Monta histórico (últimas 10 mensagens)
		const history = await conversationService.getHistory(context.conversationId, 10);
		const formattedHistory = history.map((m) => ({
			role: m.role as 'user' | 'assistant',
			content: m.content,
		}));

		// Personaliza System Prompt com nome do assistente
		const user = await userService.getUserById(context.userId);
		const assistantName = user?.assistantName || 'Nexo';

		const systemPrompt = AGENT_SYSTEM_PROMPT.replace('You are Nexo,', `You are ${assistantName},`);

		// Chama LLM
		const llmResponse = await llmService.callLLM({
			message: context.message,
			history: formattedHistory,
			systemPrompt,
		});

		// ============================================================================
		// PROCESSAR AgentLLMResponse (JSON schema)
		// ============================================================================

		const toolsUsed: string[] = [];
		let responseMessage: string = '';
		let nextState: ConversationState = 'idle';

		// DETECTA MENSAGEM DE ERRO ANTES DE PARSEAR JSON
		if (
			llmResponse.message.trim().startsWith('😅') ||
			llmResponse.message.trim().startsWith('⚠️') ||
			llmResponse.message.trim().startsWith('❌')
		) {
			loggers.ai.warn('⚠️ LLM retornou mensagem de erro ao invés de JSON');
			return {
				message: llmResponse.message.trim(),
				state: 'idle',
			};
		}

		try {
			// 1. Parsear JSON da resposta (remove markdown code blocks)
			const agentResponse = parseJSONFromLLM(llmResponse.message);

			// 2. Validar schema
			if (!isValidAgentResponse(agentResponse)) {
				throw new Error('Resposta LLM não segue schema AgentLLMResponse');
			}

			loggers.ai.info({ action: agentResponse.action }, '🤖 LLM action');

			// 3. Validar schema_version
			if (agentResponse.schema_version !== '1.0') {
				loggers.ai.warn({ version: agentResponse.schema_version }, '⚠️ Schema version incompatível');
			}

			// 4. Executar baseado na ação
			switch (agentResponse.action) {
				case 'CALL_TOOL':
					if (!agentResponse.tool) {
						throw new Error('action=CALL_TOOL requer tool');
					}

					loggers.ai.info({ tool: agentResponse.tool }, '🔧 Executando tool');
					const result = await executeTool(agentResponse.tool as any, toolContext, agentResponse.args || {});

					toolsUsed.push(agentResponse.tool);

					if (result.success) {
						// Se tem resultados
						if (result.data?.results && result.data.results.length > 0) {
							// Se é 1 resultado: pula lista, vai direto pro poster
							if (result.data.results.length === 1) {
								return await this.sendFinalConfirmation(context, conversation, result.data.results[0]);
							}
							// Se são múltiplos: mostra lista com botões
							return await this.sendCandidatesWithButtons(context, conversation, result.data.results);
						} else if (result.message) {
							// Mensagem específica da tool
							responseMessage = result.message || '';
						} else {
							// Mensagens genéricas amigáveis baseadas na tool
							responseMessage = getSuccessMessageForTool(agentResponse.tool, result.data);
						}
					} else {
						// Erro - tratar casos específicos
						loggers.ai.error({ tool: agentResponse.tool, err: result.error }, '❌ Tool falhou (detalhes acima)');

						// Casos especiais de erro
						if (result.error === 'duplicate') {
							// Duplicata detectada - usar mensagem da tool ou padrão
							responseMessage = result.message || '⚠️ Este item já foi salvo anteriormente.';
						} else if (result.message) {
							// Tool forneceu mensagem de erro específica
							responseMessage = result.message;
						} else {
							// Erro genérico
							responseMessage = result.error || '❌ Ops, algo deu errado. Tenta de novo?';
						}
					}
					break;

				case 'RESPOND':
					// LLM quer responder diretamente (sem tool)
					responseMessage = agentResponse.message || 'Ok!';
					break;

				case 'NOOP':
					// Nada a fazer
					loggers.ai.info('🚫 NOOP - nenhuma ação necessária');
					responseMessage = 'Entendido! Se precisar de algo, é só falar. 👍';
					break;

				default:
					loggers.ai.error({ action: agentResponse.action }, '❌ Action desconhecida');
					responseMessage = 'Desculpe, não entendi o que fazer.';
			}
		} catch (parseError) {
			// Fallback: NUNCA enviar JSON cru ao usuário
			logError(parseError, { context: 'AI', originalMessage: llmResponse.message.substring(0, 500) });

			responseMessage = 'Desculpe, tive um problema ao processar sua mensagem. Pode tentar de novo?';
		}

		return {
			message: responseMessage,
			state: nextState,
			toolsUsed,
		};
	}

	/**
	 * Trata confirmação do usuário
	 */
	private async handleConfirmation(context: AgentContext, conversation: any, intent: IntentResult): Promise<AgentResponse> {
		// Busca contexto anterior
		const contextData = conversation.context || {};

		// DEBUG: Log para verificar callbackData
		loggers.ai.info(
			{ callbackData: context.callbackData, provider: context.provider, state: conversation.state },
			'🐛 [DEBUG] handleConfirmation',
		);

		// Se usuário clicou em botão de callback (Telegram inline button)
		// Formato: "select_N" onde N é o índice do candidato
		if (context.callbackData?.startsWith('select_')) {
			const index = parseInt(context.callbackData.replace('select_', ''), 10);
			if (!isNaN(index) && contextData.candidates && contextData.candidates[index]) {
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
			} else {
				return {
					message: result.message || '❌ Ops, algo deu errado.',
					state: 'idle',
				};
			}
		}

		// Confirmação genérica (fallback)
		const confirmMsg = confirmationMessages[Math.floor(Math.random() * confirmationMessages.length)].replace('{type}', 'item');
		return {
			message: confirmMsg,
			state: 'idle',
		};
	}

	/**
	 * Trata negação do usuário
	 */
	private async handleDenial(context: AgentContext, conversation: any, intent: IntentResult): Promise<AgentResponse> {
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
	private async handleSavePrevious(context: AgentContext, conversation: any): Promise<AgentResponse> {
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
		} else {
			return {
				message: getRandomResponse(ERROR_MESSAGES),
				state: 'idle',
			};
		}
	}

	/**
	 * Trata conversa casual (sem LLM) com respostas contextuais
	 */
	private async handleCasual(context: AgentContext, intent: IntentResult, conversation: any): Promise<AgentResponse> {
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
			userId: context.userId,
			conversationId: context.conversationId,
		};

		const result = await executeTool('search_items', toolContext, {
			query: intent.entities?.query,
			limit: 10,
		});

		if (result.success && result.data) {
			const count = result.data.count;
			if (count === 0) {
				return {
					message: NO_ITEMS_FOUND,
					state: 'idle',
					toolsUsed: ['search_items'],
				};
			}

			const message = formatItemsList(result.data.items, count);

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
	 */
	private async handleDeleteAll(context: AgentContext): Promise<AgentResponse> {
		const toolContext: ToolContext = {
			userId: context.userId,
			conversationId: context.conversationId,
		};

		// Executar delete direto (ação irreversível)
		const result = await executeTool('delete_all_memories', toolContext, {});

		if (result.success) {
			const count = result.data?.deleted_count || 0;
			return {
				message: `✅ ${count} item(ns) deletado(s) com sucesso.`,
				state: 'idle',
				toolsUsed: ['delete_all_memories'],
			};
		}

		return {
			message: 'Erro ao deletar itens. Tente novamente.',
			state: 'idle',
		};
	}

	/**
	 * Handler: Deletar item específico (determinístico)
	 */
	private async handleDeleteItem(context: AgentContext, intent: IntentResult): Promise<AgentResponse> {
		const toolContext: ToolContext = {
			userId: context.userId,
			conversationId: context.conversationId,
		};

		// Se tem selection (número ou array), busca primeiro para pegar IDs
		if (intent.entities?.selection) {
			const selections = Array.isArray(intent.entities.selection) ? intent.entities.selection : [intent.entities.selection];

			// Buscar lista para pegar os itens
			const searchResult = await executeTool('search_items', toolContext, {
				limit: 50,
			});

			if (searchResult.success && searchResult.data) {
				const items = searchResult.data.items;
				const deletedItems: string[] = [];
				const notFoundSelections: number[] = [];

				// Filtra por tipo se especificado (ex: "deleta o filme 1" → filtra apenas filmes)
				const targetItems = intent.entities?.itemType ? items.filter((i: any) => i.type === intent.entities?.itemType) : items;

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

		const choice = parseInt(message);
		let detectedType: string | null = null;

		// 🧠 Usa NLP para detectar resposta em linguagem natural
		// Exemplos: "é um filme", "anota ai", "to falando da série", "quero como link"
		if (!isNumber || isNaN(choice)) {
			try {
				const nlpResult = await messageAnalyzer.classifyIntent(message);
				loggers.ai.info({ intent: nlpResult.intent, confidence: nlpResult.confidence, action: nlpResult.action }, '🧠 NLP Classification');

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
					loggers.ai.info({ message, detectedType, confidence: nlpResult.confidence }, `${typeEmoji[detectedType]} Tipo detectado via NLP`);
				}
			} catch (error) {
				loggers.ai.warn({ error }, '⚠️ Erro ao classificar via NLP, tentando fallback');
			}
		}

		// Se não detectou via NLP, tenta números
		if (!detectedType && isNumber) {
			switch (choice) {
				case 1:
					detectedType = 'note';
					loggers.ai.info('📝 Usuário escolheu nota (opção 1)');
					break;
				case 2:
					detectedType = 'movie';
					loggers.ai.info('🎬 Usuário escolheu filme (opção 2)');
					break;
				case 3:
					detectedType = 'series';
					loggers.ai.info('📺 Usuário escolheu série (opção 3)');
					break;
				case 4:
					detectedType = 'link';
					loggers.ai.info('🔗 Usuário escolheu link (opção 4)');
					break;
				case 5:
					// Cancela
					loggers.ai.info('❌ Usuário cancelou clarificação (opção 5)');
					await conversationService.updateState(conversation.id, 'idle', {
						pendingClarification: undefined,
					});
					return {
						message: getRandomMessage(cancellationMessages),
						state: 'idle',
					};
				default:
					// Se não é número válido (1-5), trata como NOVA MENSAGEM
					// Isso permite ao usuário ignorar a clarificação e continuar conversando
					loggers.ai.info({ message }, '↩️ Número inválido - reprocessando como nova mensagem');

					// Reseta estado e reprocessa
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
		const toolContext: ToolContext = {
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
			} else {
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
				} else {
					return {
						message: result.error || '❌ Ops, algo deu errado ao salvar.',
						state: 'idle',
					};
				}
			}
		}

		// 📝 Para NOTA: Salva direto
		if (detectedType === 'note') {
			const result = await executeTool('save_note', toolContext, {
				content: originalMessage,
			});

			await conversationService.updateState(conversation.id, 'idle', {});

			if (result.success) {
				return {
					message: `✅ Nota salva!`,
					state: 'idle',
					toolsUsed: ['save_note'],
				};
			} else {
				return {
					message: result.error || '❌ Ops, algo deu errado ao salvar.',
					state: 'idle',
				};
			}
		}

		// 🔗 Para LINK: Salva direto
		if (detectedType === 'link') {
			const result = await executeTool('save_link', toolContext, {
				url: originalMessage,
			});

			await conversationService.updateState(conversation.id, 'idle', {});

			if (result.success) {
				return {
					message: `✅ Link salvo!`,
					state: 'idle',
					toolsUsed: ['save_link'],
				};
			} else {
				return {
					message: result.error || '❌ Ops, algo deu errado ao salvar.',
					state: 'idle',
				};
			}
		}

		// Fallback: tipo desconhecido
		return {
			message: 'Não entendi o tipo. Pode tentar novamente?',
			state: 'idle',
		};
	}

	/**
	 * Envia lista de candidatos com botões clicáveis (Telegram Inline Keyboard)
	 */
	private async sendCandidatesWithButtons(context: AgentContext, conversation: any, candidates: any[]): Promise<AgentResponse> {
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
				: `🎬 Encontrei ${limitedCandidates.length} ${itemTypePtPlural}. Qual você quer salvar?\n\n`;

		limitedCandidates.forEach((candidate: any, index: number) => {
			const year = candidate.year || candidate.release_date?.split('-')[0] || '';
			const genres = candidate.genres?.slice(0, 2).join(', ') || '';
			const overview = candidate.overview || '';
			const overviewSnippet = overview.length > 300 ? `${overview.substring(0, 300)}...` : overview;

			message += `${index + 1}. *${candidate.title}* (${year})\n`;
			if (genres) message += `   📁 ${genres}\n`;
			if (overviewSnippet) message += `   📝 ${overviewSnippet}\n`;
			message += '\n';
		});

		// Salva no contexto para uso posterior (candidatos limitados)
		await conversationService.updateState(conversation.id, 'awaiting_confirmation', {
			candidates: limitedCandidates,
			detected_type: itemType,
		});

		// Se for Telegram, envia com botões
		if (context.provider === 'telegram') {
			const buttons = limitedCandidates.map((candidate: any, index: number) => [
				{
					text: `${index + 1}. ${candidate.title} (${candidate.year || candidate.release_date?.split('-')[0] || ''})`,
					callback_data: `select_${index}`,
				},
			]);

			// Obtém provider dinamicamente do contexto
			const { getProvider } = await import('@/adapters/messaging');
			const provider = getProvider(context.provider as 'telegram');

			if (provider && 'sendMessageWithButtons' in provider) {
				await (provider as any).sendMessageWithButtons(context.externalId, message, buttons);
			}

			// Retorna resposta vazia (já enviou manualmente)
			return {
				message: '',
				state: 'awaiting_confirmation',
				toolsUsed: [],
				skipFallback: true, // Não enviar fallback
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

		// Se for Telegram e tiver poster, envia foto com botões
		if (context.provider === 'telegram' && posterUrl) {
			const buttons = [
				[
					{ text: '✅ É esse mesmo!', callback_data: 'confirm_final' },
					{ text: '🔄 Escolher novamente', callback_data: 'choose_again' },
				],
			];

			// Obtém provider dinamicamente do contexto
			const { getProvider } = await import('@/adapters/messaging');
			const provider = getProvider(context.provider as 'telegram');

			if (provider && 'sendPhoto' in provider) {
				loggers.ai.info({ posterUrl, title: selected.title }, '🖼️ Enviando foto do TMDB');
				await (provider as any).sendPhoto(context.externalId, posterUrl, caption, buttons);
			}

			return {
				message: '',
				state: 'awaiting_final_confirmation',
				toolsUsed: [],
				skipFallback: true, // Não enviar fallback
			};
		}

		// Fallback: se provider não é Telegram, envia sem imagem mas COM botões
		if (context.provider === 'telegram') {
			const buttons = [
				[
					{ text: '✅ É esse mesmo!', callback_data: 'confirm_final' },
					{ text: '🔄 Escolher novamente', callback_data: 'choose_again' },
				],
			];

			// Obtém provider dinamicamente do contexto
			const { getProvider } = await import('@/adapters/messaging');
			const provider = getProvider(context.provider as 'telegram');

			if (provider && 'sendMessageWithButtons' in provider) {
				await (provider as any).sendMessageWithButtons(context.externalId, caption, buttons);
			}

			return {
				message: '',
				state: 'awaiting_final_confirmation',
				toolsUsed: [],
				skipFallback: true, // Não enviar fallback
			};
		}

		// Provider não suporta botões, envia mensagem de texto
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
			return `✅ Filme salvo!`;
		case 'save_tv_show':
			return `✅ Série salva!`;
		case 'save_video':
			return '✅ Vídeo salvo!';
		case 'save_link':
			return '✅ Link salvo!';
		case 'search_items':
			const count = data?.count || 0;
			if (count === 0) {
				return 'Não encontrei nada 😕';
			}
			return `Encontrei ${count} item(ns)`;
		case 'delete_memory':
			return '✅ Item deletado!';
		case 'delete_all_memories':
			const deleted = data?.deleted_count || 0;
			return deleted > 0 ? `✅ ${deleted} item(ns) deletado(s)` : 'Nada para deletar';
		default:
			return '✅ Feito!';
	}
}

// Singleton
export const agentOrchestrator = new AgentOrchestrator();
