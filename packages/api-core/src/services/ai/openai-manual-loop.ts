import type OpenAI from 'openai';
import type { ToolName } from '@/types';
import type { ToolContext, ToolOutput } from '@/services/tools';
import { loggers } from '@/utils/logger';
import type { OpenAIGatewayRequest, OpenAIGatewayTransport, OpenAIGatewayResponse } from './openai-gateway-transport';
import type { RuntimeRound } from './runtime-contract';

type MinimalTool = Extract<ToolName, 'save_note' | 'save_link' | 'search_items'>;

const MINIMAL_TOOL_DEFINITIONS: Record<MinimalTool, OpenAI.Chat.ChatCompletionTool> = {
	save_note: {
		type: 'function',
		function: {
			name: 'save_note',
			description: 'Salva uma nota de texto na memória do usuário.',
			parameters: {
				type: 'object',
				properties: {
					content: {
						type: 'string',
						description: 'Conteúdo da nota.',
					},
				},
				required: ['content'],
			},
		},
	},
	save_link: {
		type: 'function',
		function: {
			name: 'save_link',
			description: 'Salva um link na memória do usuário.',
			parameters: {
				type: 'object',
				properties: {
					url: {
						type: 'string',
						description: 'URL do link a salvar.',
					},
					description: {
						type: 'string',
						description: 'Descrição opcional do link.',
					},
				},
				required: ['url'],
			},
		},
	},
	search_items: {
		type: 'function',
		function: {
			name: 'search_items',
			description: 'Busca itens já salvos do usuário.',
			parameters: {
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description: 'Termo da busca. Opcional para listar recentes.',
					},
					limit: {
						type: 'number',
						description: 'Quantidade máxima de resultados.',
					},
				},
				required: [],
			},
		},
	},
};

export interface OpenAIManualLoopDependencies {
	transport: Pick<OpenAIGatewayTransport, 'createChatCompletion'>;
	executeTool: (toolName: ToolName, context: ToolContext, params: Record<string, unknown>) => Promise<ToolOutput>;
}

export interface OpenAIManualLoopRequest {
	conversationId: string;
	userId: string;
	systemPrompt: string;
	messages: OpenAI.Chat.ChatCompletionMessageParam[];
	availableTools: string[];
	toolContext: ToolContext;
	model?: string;
	maxRounds?: number;
}

export interface OpenAIManualLoopResult {
	text: string;
	toolsUsed: string[];
	rounds: number;
	lastResponse: OpenAIGatewayResponse | null;
	roundsData: RuntimeRound[];
}

export function buildManualLoopTools(availableTools: string[]): OpenAI.Chat.ChatCompletionTool[] {
	const allowSet = new Set(availableTools);
	const enabled = (Object.keys(MINIMAL_TOOL_DEFINITIONS) as MinimalTool[]).filter((toolName) => allowSet.has(toolName));
	return enabled.map((toolName) => MINIMAL_TOOL_DEFINITIONS[toolName]);
}

export async function runOpenAIManualLoop(
	request: OpenAIManualLoopRequest,
	deps: OpenAIManualLoopDependencies,
): Promise<OpenAIManualLoopResult> {
	const maxRounds = request.maxRounds ?? 6;
	const tools = buildManualLoopTools(request.availableTools);
	const conversationMessages = [...request.messages];
	const toolsUsed: string[] = [];
	const roundsData: RuntimeRound[] = [];
	let rounds = 0;
	let finalText = '';
	let lastResponse: OpenAIGatewayResponse | null = null;

	while (rounds < maxRounds) {
		rounds += 1;

		lastResponse = await deps.transport.createChatCompletion({
			conversationId: request.conversationId,
			userId: request.userId,
			systemPrompt: request.systemPrompt,
			messages: conversationMessages,
			model: request.model,
			tools,
			toolChoice: tools.length > 0 ? 'auto' : 'none',
		} as OpenAIGatewayRequest);

		roundsData.push(lastResponse.round);

		const choice = lastResponse.completion.choices[0];
		const assistantMessage = choice?.message;
		const toolCalls = assistantMessage?.tool_calls ?? [];

		if (toolCalls.length > 0) {
			conversationMessages.push({
				role: 'assistant',
				content: typeof assistantMessage.content === 'string' ? assistantMessage.content : '',
				tool_calls: toolCalls,
			});

			for (const toolCall of toolCalls) {
				const toolName = (toolCall.type === 'function' ? toolCall.function.name : toolCall.custom.name) as ToolName;
				toolsUsed.push(toolName);

				if (!request.availableTools.includes(toolName)) {
					conversationMessages.push({
						role: 'tool',
						tool_call_id: toolCall.id,
						content: JSON.stringify({
							success: false,
							error: `Tool '${toolName}' não permitida pela policy atual.`,
						}),
					});
					continue;
				}

				const rawArguments = toolCall.type === 'function' ? toolCall.function.arguments : toolCall.custom.input;
				const parsedArgs = safeParseToolArguments(rawArguments);
				const toolResult = await deps.executeTool(toolName, request.toolContext, parsedArgs);

				conversationMessages.push({
					role: 'tool',
					tool_call_id: toolCall.id,
					content: JSON.stringify({
						success: toolResult.success,
						data: toolResult.data ?? null,
						error: toolResult.error ?? null,
					}),
				});
			}

			continue;
		}

		if (typeof assistantMessage?.content === 'string' && assistantMessage.content.trim().length > 0) {
			finalText = assistantMessage.content.trim();
			break;
		}

		if (choice?.finish_reason === 'length') {
			finalText = 'A resposta atingiu o limite de tokens. Tente novamente com um pedido mais específico.';
			break;
		}

		finalText = 'Não consegui gerar uma resposta textual nesta rodada.';
		break;
	}

	if (!finalText) {
		loggers.ai.warn({ rounds }, '⚠️ Manual loop finalizou sem texto final');
		finalText = 'Não consegui concluir a resposta no momento. Tente novamente em instantes.';
	}

	return {
		text: finalText,
		toolsUsed,
		rounds,
		lastResponse,
		roundsData,
	};
}

function safeParseToolArguments(raw: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
		return {};
	} catch {
		return {};
	}
}