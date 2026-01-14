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
import { llmService } from './ai';
import { executeTool, type ToolContext, type ToolOutput } from './tools';
import {
	CASUAL_GREETINGS,
	GENERIC_CONFIRMATION,
	CANCELLATION_PROMPT,
	NO_ITEMS_FOUND,
	SAVE_SUCCESS,
	GENERIC_ERROR,
	formatItemsList,
} from '@/config/prompts';
import type { ConversationState, AgentLLMResponse } from '@/types';
import { parseJSONFromLLM, isValidAgentResponse } from '@/utils/json-parser';
import { scheduleConversationClose } from './queue-service';

export interface AgentContext {
	userId: string;
	conversationId: string;
	externalId: string;
	message: string;
}

export interface AgentResponse {
	message: string;
	state: ConversationState;
	toolsUsed?: string[];
}

/**
 * Orquestrador principal do agente
 */
export class AgentOrchestrator {
	/**
	 * Processa mensagem do usuário
	 */
	async processMessage(context: AgentContext): Promise<AgentResponse> {
		console.log('🎯 [Agent] Processando mensagem:', context.message);

		// 1. CLASSIFICAR INTENÇÃO (determinístico)
		const intent = await intentClassifier.classify(context.message);
		console.log(`🧠 [Agent] Intenção detectada: ${intent.intent} (${intent.confidence})`);

		// 2. BUSCAR ESTADO ATUAL
		const conversation = await conversationService.findOrCreateConversation(context.userId);
		console.log(`📊 [Agent] Estado atual: ${conversation.state}`);

		// 3. DECIDIR AÇÃO BASEADO EM INTENÇÃO + ESTADO
		const action = this.decideAction(intent, conversation.state);
		console.log('⚡ [Agent] ===== DECISÃO DE AÇÃO =====');
		console.log(`Estado: ${conversation.state}`);
		console.log(`Intent: ${intent.intent}`);
		console.log(`Action verb: ${intent.action}`);
		console.log(`Ação decidida: ${action}`);
		console.log('⚡ [Agent] ===== FIM DECISÃO =====');

		// 4. EXECUTAR AÇÃO
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
				response = await this.handleConfirmation(context, conversation);
				break;

			case 'handle_denial':
				response = await this.handleDenial(context, conversation);
				break;

			case 'handle_casual':
				response = await this.handleCasual(context);
				break;

			case 'handle_get_assistant_name':
				response = await this.handleGetAssistantName(context);
				break;

			default:
				response = {
					message: 'Não entendi. Pode reformular?',
					state: 'idle',
				};
		}

		// 5. ATUALIZAR ESTADO
		await conversationService.updateState(conversation.id, response.state, {
			lastIntent: intent.intent,
			lastAction: action,
		});

		// 6. SALVAR MENSAGENS
		await conversationService.addMessage(conversation.id, 'user', context.message);
		await conversationService.addMessage(conversation.id, 'assistant', response.message);

		// 7. AGENDAR FECHAMENTO SE A AÇÃO FINALIZOU
		// Fecha conversa em 3min se estado voltar para 'open' (idle)
		if (response.state === 'idle' && action !== 'handle_casual') {
			await scheduleConversationClose(conversation.id);
			console.log(`📅 [Agent] Fechamento agendado para ${conversation.id} em 3min`);
		}

		console.log(`✅ [Agent] Resposta gerada (${response.message?.length || 0} chars)`);
		return response;
	}

	/**
	 * Decide qual ação tomar baseado em intenção + estado
	 */
	private decideAction(intent: IntentResult, state: ConversationState): string {
		// Confirmação/Negação só importam se estamos aguardando
		if (state === 'awaiting_confirmation') {
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

		// Chama LLM
		const llmResponse = await llmService.callLLM({
			message: context.message,
			history: formattedHistory,
		});

		// ============================================================================
		// PROCESSAR AgentLLMResponse (JSON schema)
		// ============================================================================

		const toolsUsed: string[] = [];
		let responseMessage: string = '';
		let nextState: ConversationState = 'idle';

		try {
			// 1. Parsear JSON da resposta (remove markdown code blocks)
			const agentResponse = parseJSONFromLLM(llmResponse.message);

			// 2. Validar schema
			if (!isValidAgentResponse(agentResponse)) {
				throw new Error('Resposta LLM não segue schema AgentLLMResponse');
			}

			console.log(`🤖 [Agent] LLM action: ${agentResponse.action}`);
			4;
			// 3. Validar schema_version
			if (agentResponse.schema_version !== '1.0') {
				console.warn(`⚠️ [Agent] Schema version incompatível: ${agentResponse.schema_version}`);
			}

			// 3. Executar baseado na ação
			switch (agentResponse.action) {
				case 'CALL_TOOL':
					if (!agentResponse.tool) {
						throw new Error('action=CALL_TOOL requer tool');
					}

					console.log(`🔧 [Agent] Executando tool: ${agentResponse.tool}`);
					const result = await executeTool(agentResponse.tool as any, toolContext, agentResponse.args || {});

					toolsUsed.push(agentResponse.tool);

					if (result.success) {
						// Se tem múltiplos resultados, pedir confirmação
						if (result.data?.results && result.data.results.length > 1) {
							// Formatar opções para o usuário
							const options = result.data.results
								.map((r: any, i: number) => `${i + 1}. ${r.title || r.name} ${r.year ? `(${r.year})` : ''}`)
								.join('\n');

							responseMessage = `Encontrei ${result.data.results.length} opções:\n\n${options}\n\nQual você quer salvar?`;
							nextState = 'awaiting_confirmation';

							// Salvar candidatos no contexto
							await conversationService.updateState(conversation.id, nextState, {
								candidates: result.data.results,
								awaiting_selection: true,
								detected_type: agentResponse.tool.replace('enrich_', ''),
							});
						} else if (result.data?.results && result.data.results.length === 1) {
							// Um único resultado - salvar automaticamente
							const item = result.data.results[0];
							responseMessage = `✅ Salvo: ${item.title} ${item.year ? `(${item.year})` : ''}`;
						} else if (result.message) {
							// Mensagem específica da tool
							responseMessage = result.message;
						} else {
							// Mensagens genéricas amigáveis baseadas na tool
							responseMessage = getSuccessMessageForTool(agentResponse.tool, result.data);
						}
					} else {
						// Erro - mensagem amigável
						responseMessage = result.error || '❌ Ops, algo deu errado. Tenta de novo?';
					}
					break;

				case 'RESPOND':
					// LLM quer responder diretamente (sem tool)
					responseMessage = agentResponse.message || 'Ok!';
					break;

				case 'NOOP':
					// Nada a fazer
					console.log('🚫 [Agent] NOOP - nenhuma ação necessária');
					responseMessage = null as any; // Sem resposta
					break;

				default:
					console.error(`❌ [Agent] Action desconhecida: ${agentResponse.action}`);
					responseMessage = 'Desculpe, não entendi o que fazer.';
			}
		} catch (parseError) {
			// Fallback: NUNCA enviar JSON cru ao usuário
			console.error('❌ [Agent] Erro ao processar resposta LLM:', parseError);
			console.error('🔍 [Agent] Resposta original:', llmResponse.message.substring(0, 500));

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
	private async handleConfirmation(context: AgentContext, conversation: any): Promise<AgentResponse> {
		// Busca contexto anterior
		const contextData = conversation.context || {};

		// Se há candidatos aguardando seleção
		if (contextData.candidates && Array.isArray(contextData.candidates)) {
			const intent = await intentClassifier.classify(context.message);
			const selection = intent.entities?.selection;

			if (selection && selection <= contextData.candidates.length) {
				const selected = contextData.candidates[selection - 1];

				// Salva o item selecionado
				const toolContext: ToolContext = {
					userId: context.userId,
					conversationId: context.conversationId,
				};

				// TODO: Determinar qual tool específica usar baseado no tipo
				const toolName = selected.type === 'movie' ? 'save_movie' : 'save_note';
				await executeTool(toolName as any, toolContext, {
					title: selected.title,
					...selected,
				});

				return {
					message: `✅ ${selected.title} salvo!`,
					state: 'idle',
					toolsUsed: [toolName],
				};
			}
		}

		// Confirmação genérica
		return {
			message: GENERIC_CONFIRMATION,
			state: 'idle',
		};
	}

	/**
	 * Trata negação do usuário
	 */
	private async handleDenial(context: AgentContext, conversation: any): Promise<AgentResponse> {
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
				message: GENERIC_ERROR,
				state: 'idle',
			};
		}
	}

	/**
	 * Trata conversa casual (sem LLM)
	 */
	private async handleCasual(context: AgentContext): Promise<AgentResponse> {
		const msg = context.message.toLowerCase().trim();
		const response = CASUAL_GREETINGS[msg] || 'Oi! 👋';

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

		// Se tem selection (número), busca primeiro para pegar ID
		if (intent.entities?.selection) {
			// Buscar lista para pegar o item N
			const searchResult = await executeTool('search_items', toolContext, {
				limit: 20,
			});

			if (searchResult.success && searchResult.data) {
				const items = searchResult.data.items;
				const index = intent.entities.selection - 1;

				if (index >= 0 && index < items.length) {
					const itemToDelete = items[index];

					// Deletar o item
					const deleteResult = await executeTool('delete_memory', toolContext, {
						item_id: itemToDelete.id,
					});

					if (deleteResult.success) {
						return {
							message: `✅ "${itemToDelete.title}" deletado com sucesso.`,
							state: 'idle',
							toolsUsed: ['search_memory', 'delete_memory'],
						};
					}
				} else {
					return {
						message: `Item ${intent.entities.selection} não encontrado. Você tem ${items.length} item(ns) salvos.`,
						state: 'idle',
					};
				}
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
