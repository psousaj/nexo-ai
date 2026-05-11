import type { NormalizedResponse, StreamChunk } from './types';

export interface BuildKwargsParams {
	model: string;
	messages: Array<Record<string, unknown>>;
	systemPrompt?: string;
	tools?: Array<Record<string, unknown>>;
	maxTokens?: number;
	reasoningConfig?: Record<string, unknown>;
	providerPrefs?: Record<string, unknown>;
	stream?: boolean;
}

export abstract class ProviderTransport {
	abstract apiMode: string;
	abstract buildKwargs(params: BuildKwargsParams): Record<string, unknown>;
	abstract normalizeResponse(raw: unknown): NormalizedResponse;
	abstract normalizeStreamChunk(raw: unknown): StreamChunk;
	buildClientKwargs(): { baseURL?: string; defaultHeaders?: Record<string, string> } {
		return {};
	}
}
