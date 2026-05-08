import OpenAI from 'openai';
import type { NormalizedResponse, ToolCall } from './types';
import { ProviderTransport } from './base';
import type { BuildKwargsParams } from './base';

export interface ProviderFlags {
	isOpenRouter?: boolean;
	isDeepSeek?: boolean;
	isMoonshot?: boolean;
	isNvidia?: boolean;
}

export class ChatCompletionsTransport extends ProviderTransport {
	apiMode = 'chat_completions';

	buildKwargs(params: BuildKwargsParams): Record<string, unknown> {
		const { model, messages, systemPrompt, tools, maxTokens, reasoningConfig, providerPrefs } = params;
		const flags = this.detectFlags(model, providerPrefs);

		const kwargs: Record<string, unknown> = {
			model,
			messages: this.buildMessages(messages, systemPrompt),
		};

		if (tools && tools.length > 0) {
			kwargs.tools = flags.isMoonshot ? this.sanitizeMoonshotTools(tools) : tools;
		}

		if (maxTokens) kwargs.max_tokens = maxTokens;

		if (flags.isOpenRouter) {
			const extraBody: Record<string, unknown> = {};
			if (reasoningConfig) extraBody.provider = reasoningConfig;
			if (Object.keys(extraBody).length > 0) kwargs.extra_body = extraBody;
		}

		if (flags.isDeepSeek && reasoningConfig) {
			kwargs.extra_body = { ...((kwargs.extra_body as object) || {}), reasoning: reasoningConfig };
		}

		if (flags.isNvidia && !kwargs.max_tokens) {
			kwargs.max_tokens = 16384;
		}

		return kwargs;
	}

	normalizeResponse(raw: unknown): NormalizedResponse {
		const response = raw as OpenAI.Chat.Completions.ChatCompletion;
		const choice = response.choices?.[0];
		const message = choice?.message;

		const toolCalls: ToolCall[] | null =
			message?.tool_calls
				?.filter((tc): tc is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall =>
					tc.type === 'function',
				)
				.map((tc) => ({
					id: tc.id,
					name: tc.function.name,
					arguments: JSON.parse(tc.function.arguments || '{}'),
				})) ?? null;

		return {
			content: message?.content ?? null,
			toolCalls: toolCalls?.length ? toolCalls : null,
			finishReason: (choice?.finish_reason as NormalizedResponse['finishReason']) ?? 'stop',
			reasoning: (message as any).reasoning_content ?? null,
			usage: response.usage
				? {
						promptTokens: response.usage.prompt_tokens,
						completionTokens: response.usage.completion_tokens,
						totalTokens: response.usage.total_tokens,
					}
				: null,
			providerData: {
				model: response.model,
				...(message as any).reasoning_content ? { reasoning_content: (message as any).reasoning_content } : {},
			},
		};
	}

	private buildMessages(
		messages: Array<{ role: string; content: string }>,
		systemPrompt?: string,
	): Array<{ role: string; content: string }> {
		const result: Array<{ role: string; content: string }> = [];
		if (systemPrompt) result.push({ role: 'system', content: systemPrompt });
		result.push(...messages);
		return result;
	}

	private detectFlags(_model: string, prefs?: Record<string, unknown>): ProviderFlags {
		return {
			isOpenRouter: prefs?.provider === 'openrouter',
			isDeepSeek: prefs?.provider === 'deepseek',
			isMoonshot: prefs?.provider === 'moonshot',
			isNvidia: prefs?.provider === 'nvidia',
		};
	}

	private sanitizeMoonshotTools(tools: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
		return tools.map((tool) => {
			const cloned = { ...tool };
			if (cloned.function && typeof cloned.function === 'object') {
				const fn = cloned.function as Record<string, unknown>;
				if (fn.parameters && typeof fn.parameters === 'object') {
					const params = fn.parameters as Record<string, unknown>;
					if (params.additionalProperties !== undefined) delete params.additionalProperties;
				}
			}
			return cloned;
		});
	}
}
