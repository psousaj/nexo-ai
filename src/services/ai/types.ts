/**
 * Types para o sistema de AI multi-provider
 */

export interface Message {
	role: 'user' | 'assistant';
	content: string;
}

export interface AIResponse {
	message: string;
	action?: 'save_item' | 'search_items' | 'enrich_metadata';
	data?: any;
	tool_calls?: Array<{
		id: string;
		type: 'function';
		function: {
			name: string;
			arguments: string;
		};
	}>;
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

export type AIProviderType = 'cloudflare' | 'gemini';
