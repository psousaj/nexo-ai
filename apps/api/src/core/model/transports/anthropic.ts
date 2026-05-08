import type { NormalizedResponse, ToolCall } from './types';
import { ProviderTransport } from './base';
import type { BuildKwargsParams } from './base';

interface AnthropicContent {
	type: string;
	text?: string;
	name?: string;
	input?: Record<string, unknown>;
	id?: string;
	thinking?: string;
	signature?: string;
}

interface AnthropicMessage {
	role: 'user' | 'assistant';
	content: string | AnthropicContent[];
}

interface AnthropicResponse {
	id: string;
	content: AnthropicContent[];
	stop_reason: string;
	usage: { input_tokens: number; output_tokens: number };
}

export class AnthropicTransport extends ProviderTransport {
	apiMode = 'anthropic_messages';

	buildKwargs(params: BuildKwargsParams): Record<string, unknown> {
		const { model, messages, systemPrompt, tools, maxTokens, reasoningConfig } = params;

		const kwargs: Record<string, unknown> = {
			model,
			messages: this.toAnthropicMessages(messages),
			max_tokens: maxTokens ?? 4096,
		};

		if (systemPrompt) {
			kwargs.system = systemPrompt;
		}

		if (tools && tools.length > 0) {
			kwargs.tools = tools.map((t) => ({
				name: (t as any).name ?? (t as any).function?.name ?? 'unknown',
				description: (t as any).description ?? '',
				input_schema: (t as any).parameters ?? (t as any).function?.parameters ?? {},
			}));
		}

		if (reasoningConfig) {
			kwargs.thinking = reasoningConfig;
		}

		return kwargs;
	}

	normalizeResponse(raw: unknown): NormalizedResponse {
		const response = raw as AnthropicResponse;
		const contentBlocks = response.content ?? [];

		const textBlock = contentBlocks.find((b) => b.type === 'text');
		const toolUseBlocks = contentBlocks.filter((b) => b.type === 'tool_use');
		const thinkingBlock = contentBlocks.find((b) => b.type === 'thinking');

		const toolCalls: ToolCall[] | null = toolUseBlocks.length
			? toolUseBlocks.map((b) => ({
					id: b.id ?? `tool_${Math.random().toString(36).slice(2, 8)}`,
					name: b.name ?? 'unknown',
					arguments: b.input ?? {},
				}))
			: null;

		return {
			content: textBlock?.text ?? null,
			toolCalls,
			finishReason: response.stop_reason === 'end_turn' || response.stop_reason === 'stop'
				? 'stop'
				: response.stop_reason === 'tool_use'
					? 'tool_calls'
					: 'length',
			reasoning: thinkingBlock?.thinking ?? null,
			usage: response.usage
				? {
						promptTokens: response.usage.input_tokens,
						completionTokens: response.usage.output_tokens,
						totalTokens: response.usage.input_tokens + response.usage.output_tokens,
					}
				: null,
			providerData: thinkingBlock?.signature
				? { thought_signature: thinkingBlock.signature }
				: null,
		};
	}

	private toAnthropicMessages(
		messages: Array<{ role: string; content: string }>,
	): AnthropicMessage[] {
		return messages.map((msg) => ({
			role: msg.role === 'assistant' ? 'assistant' : 'user',
			content: msg.content,
		}));
	}
}
