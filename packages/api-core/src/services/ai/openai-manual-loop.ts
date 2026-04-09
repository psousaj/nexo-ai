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

const SUPPORTED_MINIMAL_TOOLS = new Set<MinimalTool>(Object.keys(MINIMAL_TOOL_DEFINITIONS) as MinimalTool[]);

type ChatCompletionToolCallWithCustom = OpenAI.Chat.Completions.ChatCompletionMessageToolCall & {
	custom?: {
		name?: string;
		input?: unknown;
	};
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
	const unsupportedTools = availableTools.filter((toolName) => !SUPPORTED_MINIMAL_TOOLS.has(toolName as MinimalTool));
	if (unsupportedTools.length > 0) {
		loggers.ai.warn(
			{ unsupportedTools },
			'⚠️ Manual loop recebeu tools sem definição e irá ignorá-las durante tool-calling.',
		);
	}

	const enabled = availableTools.filter((toolName): toolName is MinimalTool =>
		SUPPORTED_MINIMAL_TOOLS.has(toolName as MinimalTool),
	);
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

			for (const [index, toolCall] of toolCalls.entries()) {
				const toolCallId = resolveToolCallId(toolCall, rounds, index);
				const resolvedToolCall = resolveToolCall(toolCall);
				if (!resolvedToolCall) {
					conversationMessages.push({
						role: 'tool',
						tool_call_id: toolCallId,
						content: JSON.stringify({
							success: false,
							error: 'Tool call inválida recebida do modelo.',
						}),
					});
					continue;
				}

				const toolName = resolvedToolCall.name as ToolName;
				toolsUsed.push(toolName);

				if (!request.availableTools.includes(toolName)) {
					conversationMessages.push({
						role: 'tool',
						tool_call_id: toolCallId,
						content: JSON.stringify({
							success: false,
							error: `Tool '${toolName}' não permitida pela policy atual.`,
						}),
					});
					continue;
				}

				const parsedArgs = safeParseToolArguments(resolvedToolCall.rawArguments);
				const toolResult = await deps.executeTool(toolName, request.toolContext, parsedArgs);

				conversationMessages.push({
					role: 'tool',
					tool_call_id: toolCallId,
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

function resolveToolCall(
	toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
): { name: string; rawArguments: unknown } | null {
	const functionCall = (toolCall as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall).function;
	if (functionCall && typeof functionCall.name === 'string') {
		return {
			name: functionCall.name,
			rawArguments: functionCall.arguments,
		};
	}

	const customCall = (toolCall as ChatCompletionToolCallWithCustom).custom;
	if (customCall && typeof customCall.name === 'string') {
		return {
			name: customCall.name,
			rawArguments: customCall.input,
		};
	}

	return null;
}

function resolveToolCallId(
	toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
	round: number,
	index: number,
): string {
	if (typeof toolCall.id === 'string' && toolCall.id.trim().length > 0) {
		return toolCall.id;
	}

	return `tool_call_${round}_${index}`;
}

function safeParseToolArguments(raw: unknown): Record<string, unknown> {
	if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
		return raw as Record<string, unknown>;
	}

	if (typeof raw !== 'string') {
		return {};
	}

	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
		return {};
	} catch {
		return {};
	}
}