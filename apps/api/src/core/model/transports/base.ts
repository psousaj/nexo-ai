import type { NormalizedResponse } from './types';

export interface BuildKwargsParams {
	model: string;
	messages: Array<{ role: string; content: string }>;
	systemPrompt?: string;
	tools?: Array<Record<string, unknown>>;
	maxTokens?: number;
	reasoningConfig?: Record<string, unknown>;
	providerPrefs?: Record<string, unknown>;
}

export abstract class ProviderTransport {
	abstract apiMode: string;
	abstract buildKwargs(params: BuildKwargsParams): Record<string, unknown>;
	abstract normalizeResponse(raw: unknown): NormalizedResponse;
	buildClientKwargs(): { baseURL?: string; defaultHeaders?: Record<string, string> } {
		return {};
	}
}
