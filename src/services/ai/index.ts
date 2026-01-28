import { env } from '@/config/env';
import { AGENT_SYSTEM_PROMPT } from '@/config/prompts';
import { loggers } from '@/utils/logger';
import { CloudflareAIGatewayProvider } from './cloudflare-ai-gateway-provider';
import type { AIProvider, AIResponse, Message } from './types';

/**
 * Serviço AI usando Cloudflare AI Gateway
 *
 * O AI Gateway gerencia automaticamente:
 * - Fallback entre providers (via Dynamic Routes)
 * - Retry automático (até 5 tentativas)
 * - Cache, rate limiting, analytics
 */
export class AIService {
	private provider: CloudflareAIGatewayProvider;

	constructor(
		accountId: string,
		gatewayId: string,
		cfApiToken: string,
		defaultModel: string = 'dynamic/cloudflare'
	) {
		this.provider = new CloudflareAIGatewayProvider(accountId, gatewayId, cfApiToken, defaultModel);
		loggers.ai.info('🤖 AI Service inicializado com AI Gateway');
	}

	/**
	 * Chama o LLM com contexto da conversação
	 * Retry e fallback são gerenciados pelo AI Gateway
	 */
	async callLLM(params: { message: string; history?: Message[]; systemPrompt?: string }): Promise<AIResponse> {
		const { systemPrompt, ...rest } = params;
		const prompt = systemPrompt || AGENT_SYSTEM_PROMPT;

		loggers.ai.info(`📩 Mensagem: "${params.message.substring(0, 100)}${params.message.length > 100 ? '...' : ''}"`);
		loggers.ai.info(`📜 Histórico: ${params.history?.length || 0} mensagens`);

		return this.provider.callLLM({
			...rest,
			systemPrompt: prompt,
		});
	}

	/**
	 * Altera o modelo em runtime
	 * Ex: 'dynamic/cloudflare', 'google-ai-studio/gemini-2.5-flash-lite'
	 */
	setModel(model: string): void {
		this.provider.setModel(model);
	}

	/**
	 * Retorna o provider ativo (sempre 'ai-gateway')
	 */
	getCurrentProvider(): string {
		return this.provider.getName();
	}
}

// Singleton - credenciais são obrigatórias no env
export const llmService = new AIService(
	env.CLOUDFLARE_ACCOUNT_ID,
	env.CLOUDFLARE_GATEWAY_ID,
	env.CLOUDFLARE_API_TOKEN
);
export type { AIProvider, AIResponse, Message } from './types';
