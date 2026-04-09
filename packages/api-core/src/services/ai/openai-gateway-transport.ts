import { loggers } from '@/utils/logger';
import OpenAI from 'openai';
import {
	addRuntimeBlock,
	buildRuntimeUsageFromOpenAI,
	createRuntimeRound,
	mapOpenAIFinishReasonToRuntimeStopReason,
	normalizeGatewayHeaders,
	type RuntimeRound,
} from './runtime-contract';

export interface OpenAIGatewayTransportConfig {
	accountId: string;
	gatewayId: string;
	apiToken: string;
	model: string;
	basePath?: 'compat' | 'openai';
	requestTimeoutMs?: number;
	collectLog?: boolean;
}

export interface OpenAIGatewayRequest {
	conversationId: string;
	userId: string;
	messages: OpenAI.Chat.ChatCompletionMessageParam[];
	systemPrompt?: string;
	model?: string;
	temperature?: number;
	maxTokens?: number;
	tools?: OpenAI.Chat.ChatCompletionTool[];
	toolChoice?: OpenAI.Chat.ChatCompletionToolChoiceOption;
	extraHeaders?: Record<string, string>;
}

export interface OpenAIGatewayResponse {
	completion: OpenAI.Chat.Completions.ChatCompletion;
	round: RuntimeRound;
}

export class OpenAIGatewayTransport {
	private readonly client: OpenAI;
	private model: string;
	private readonly baseURL: string;
	private readonly collectLog: boolean;

	constructor(config: OpenAIGatewayTransportConfig) {
		const basePath = config.basePath ?? 'compat';
		this.baseURL = OpenAIGatewayTransport.buildBaseURL(config.accountId, config.gatewayId, basePath);
		this.model = config.model;
		this.collectLog = config.collectLog ?? true;

		this.client = new OpenAI({
			apiKey: config.apiToken,
			baseURL: this.baseURL,
			timeout: config.requestTimeoutMs ?? 25000,
			maxRetries: 0,
		});

		loggers.ai.info({ baseURL: this.baseURL, model: this.model }, '✅ OpenAI Gateway transport configurado');
	}

	static buildBaseURL(accountId: string, gatewayId: string, basePath: 'compat' | 'openai' = 'compat'): string {
		return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/${basePath}`;
	}

	getBaseURL(): string {
		return this.baseURL;
	}

	getModel(): string {
		return this.model;
	}

	setModel(model: string): void {
		this.model = model;
	}

	async createChatCompletion(request: OpenAIGatewayRequest): Promise<OpenAIGatewayResponse> {
		const model = request.model ?? this.model;
		const runtimeRound = createRuntimeRound({
			conversationId: request.conversationId,
			userId: request.userId,
			model,
			gatewayBaseUrl: this.baseURL,
		});

		const messages = request.systemPrompt
			? ([
					{ role: 'system', content: request.systemPrompt } as OpenAI.Chat.ChatCompletionSystemMessageParam,
					...request.messages,
				] as OpenAI.Chat.ChatCompletionMessageParam[])
			: request.messages;

		try {
			const completion = await this.client.chat.completions.create(
				{
					model,
					messages,
					temperature: request.temperature,
					max_tokens: request.maxTokens,
					tools: request.tools,
					tool_choice: request.toolChoice,
				},
				{
					headers: {
						...(this.collectLog ? { 'cf-aig-collect-log': 'true' } : {}),
						...(request.extraHeaders ?? {}),
					},
				},
			);

			runtimeRound.stopReason = mapOpenAIFinishReasonToRuntimeStopReason(completion.choices[0]?.finish_reason);
			runtimeRound.usage = buildRuntimeUsageFromOpenAI(completion.usage);

			const assistantMessage = completion.choices[0]?.message;
			if (typeof assistantMessage?.content === 'string' && assistantMessage.content.trim().length > 0) {
				addRuntimeBlock(runtimeRound, {
					type: 'assistant_text',
					text: assistantMessage.content,
				});
			}

			for (const toolCall of assistantMessage?.tool_calls ?? []) {
				addRuntimeBlock(runtimeRound, {
					type: 'tool_use',
					id: toolCall.id,
					name: toolCall.function.name,
					input: this.safeParseToolArguments(toolCall.function.arguments),
				});
			}

			return {
				completion,
				round: runtimeRound,
			};
		} catch (error) {
			const err = error as any;
			const headers = normalizeGatewayHeaders((err?.responseHeaders ?? {}) as Record<string, string | null | undefined>);
			runtimeRound.gatewayHeaders = headers;

			addRuntimeBlock(runtimeRound, {
				type: 'error',
				code: String(err?.statusCode ?? 'openai_gateway_error'),
				message: err?.message ?? 'Erro de transporte OpenAI Gateway',
				retryable: this.isRetryableError(err),
			});

			throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
				runtimeRound,
			});
		}
	}

	private safeParseToolArguments(rawArguments: string): Record<string, unknown> {
		try {
			const parsed = JSON.parse(rawArguments);
			return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
		} catch {
			return {};
		}
	}

	private isRetryableError(err: any): boolean {
		const statusCode = Number(err?.statusCode ?? err?.status ?? 0);
		return statusCode === 429 || statusCode >= 500;
	}
}