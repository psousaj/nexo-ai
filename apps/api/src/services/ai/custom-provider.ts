import OpenAI from 'openai';
import {
	addRuntimeBlock,
	buildRuntimeUsageFromOpenAI,
	createRuntimeRound,
	mapOpenAIFinishReasonToRuntimeStopReason,
} from './runtime-contract';
import type { RuntimeRound } from './runtime-contract';
import type { AIProvider, CallLLMParams } from './types';

export class CustomProvider implements AIProvider {
	private client: OpenAI;
	private name: string;

	constructor(apiKey: string, baseUrl: string, name: string = 'Custom') {
		this.name = name;
		this.client = new OpenAI({
			apiKey,
			baseURL: baseUrl,
			timeout: 25000,
			maxRetries: 0,
		});
	}

	getName(): string {
		return this.name;
	}

	getType(): 'custom' {
		return 'custom';
	}

	async isAvailable(): Promise<boolean> {
		try {
			await this.client.models.list();
			return true;
		} catch {
			return false;
		}
	}

	async callLLM(params: CallLLMParams): Promise<{
		round: RuntimeRound;
		completion: OpenAI.Chat.Completions.ChatCompletion;
	}> {
		const runtimeRound = createRuntimeRound({
			conversationId: 'internal',
			userId: 'internal',
			model: params.model,
			gatewayBaseUrl: this.client.baseURL,
		});

		try {
			const completion = await this.client.chat.completions.create({
				model: params.model,
				messages: params.messages as OpenAI.Chat.ChatCompletionMessageParam[],
				temperature: params.temperature,
				max_tokens: params.maxTokens,
				response_format:
					params.responseFormat === 'json_object' ? { type: 'json_object' as const } : undefined,
			});

			runtimeRound.stopReason = mapOpenAIFinishReasonToRuntimeStopReason(completion.choices[0]?.finish_reason);
			runtimeRound.usage = buildRuntimeUsageFromOpenAI(completion.usage);

			const msg = completion.choices[0]?.message;
			if (typeof msg?.content === 'string' && msg.content.trim().length > 0) {
				addRuntimeBlock(runtimeRound, { type: 'assistant_text', text: msg.content });
			}

			return { round: runtimeRound, completion };
		} catch (error: any) {
			addRuntimeBlock(runtimeRound, {
				type: 'error',
				code: String(error?.statusCode ?? error?.status ?? 'custom_provider_error'),
				message: error?.message ?? 'Custom provider error',
				retryable: Number(error?.statusCode ?? error?.status ?? 0) >= 429,
			});
			throw Object.assign(error instanceof Error ? error : new Error(String(error)), { runtimeRound });
		}
	}
}
