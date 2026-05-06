import type OpenAI from 'openai';
import type { RuntimeRound } from './runtime-contract';

export type AIProviderType = 'cloudflare' | 'openai' | 'deepseek';

export type ModelContextType = 'chat' | 'embedding' | 'intent' | 'stt' | 'tts';

export interface ModelRegistryEntry {
	id: number;
	provider: AIProviderType;
	modelId: string;
	displayName: string | null;
	enabled: boolean;
	priority: number;
	isDefault: boolean;
	contextTypes: ModelContextType[];
	createdAt: Date;
	updatedAt: Date;
}

export interface CallLLMParams {
	model: string;
	messages: Array<{
		role: 'system' | 'user' | 'assistant' | 'tool';
		content: string;
		tool_call_id?: string;
		tool_calls?: Array<{
			id: string;
			type: 'function';
			function: { name: string; arguments: string };
		}>;
	}>;
	temperature?: number;
	maxTokens?: number;
	tools?: Array<{
		type: 'function';
		function: {
			name: string;
			description: string;
			parameters: Record<string, unknown>;
		};
	}>;
	toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
	responseFormat?: 'text' | 'json_object';
}

export interface AIProvider {
	callLLM(params: CallLLMParams): Promise<{
		round: RuntimeRound;
		completion: OpenAI.Chat.Completions.ChatCompletion;
	}>;
	getName(): string;
	getType(): AIProviderType;
	isAvailable(): Promise<boolean>;
}
