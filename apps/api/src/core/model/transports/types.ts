export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

export interface Usage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

export interface NormalizedResponse {
	content: string | null;
	toolCalls: ToolCall[] | null;
	finishReason: 'stop' | 'tool_calls' | 'length';
	reasoning: string | null;
	usage: Usage | null;
	providerData: Record<string, unknown> | null;
}

export type ApiMode = 'chat_completions' | 'anthropic_messages';

export function detectApiMode(baseUrl: string): ApiMode {
	if (baseUrl.includes('anthropic.com')) return 'anthropic_messages';
	return 'chat_completions';
}
