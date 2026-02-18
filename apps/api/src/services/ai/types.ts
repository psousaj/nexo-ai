/**
 * Types para o sistema de AI multi-provider
 */

export interface Message {
	role: 'user' | 'assistant';
	content: string;
}

import type { AgentLLMResponse } from '@/types';

export interface AIResponse {
	// Resposta em texto bruto (pode ser JSON string)
	message: string;
	// Tool calls legado (ainda usado por Gemini SDK)
	tool_calls?: Array<{
		id: string;
		type: 'function';
		function: {
			name: string;
			arguments: string;
		};
	}>;
	// JSON parsed (AgentLLMResponse) - será preenchido pelo service
	parsedResponse?: AgentLLMResponse;
}

export interface AIProvider {
	/**
	 * Chama o LLM com contexto da conversação
	 */
	callLLM(params: { message: string; history?: Message[]; systemPrompt?: string }): Promise<AIResponse>;

	/**
	 * Retorna o nome do provider (para logs)
	 */
	getName(): string;
}

export type AIProviderType = 'ai-gateway';
