import { env } from '@/config/env';
import { AGENT_SYSTEM_PROMPT } from '@/config/prompts';
import { loggers } from '@/utils/logger';
import { startSpan, setAttributes, getCurrentTraceId } from '@nexo/otel/tracing';
import { getLangfuse } from '@/services/langfuse';
import { CloudflareAIGatewayProvider } from './cloudflare-ai-gateway-provider';
import type { AIResponse, Message } from './types';

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

	constructor(accountId: string, gatewayId: string, cfApiToken: string, defaultModel = 'dynamic/cloudflare') {
		this.provider = new CloudflareAIGatewayProvider(accountId, gatewayId, cfApiToken, defaultModel);
		loggers.ai.info('🤖 AI Service inicializado com AI Gateway');
	}

	/**
	 * Chama o LLM com contexto da conversação
	 * Retry e fallback são gerenciados pelo AI Gateway
	 */
	async callLLM(params: { message: string; history?: Message[]; systemPrompt?: string }): Promise<AIResponse> {
		return startSpan('llm.call', async (span) => {
			const { systemPrompt, ...rest } = params;
			const prompt = systemPrompt || AGENT_SYSTEM_PROMPT;

			setAttributes({
				'llm.message_length': params.message.length,
				'llm.history_count': params.history?.length || 0,
				'llm.system_prompt_length': prompt.length,
			});

			loggers.ai.info(`📩 Mensagem: "${params.message.substring(0, 100)}${params.message.length > 100 ? '...' : ''}"`);
			loggers.ai.info(`📜 Histórico: ${params.history?.length || 0} mensagens`);

			// Langfuse integration
			const langfuse = getLangfuse();
			const traceId = getCurrentTraceId();
			let generation: any = null;

			if (langfuse) {
				generation = langfuse.trace({
					name: 'llm_call',
					id: traceId,
				}).generation({
					model: this.provider.getCurrentModel(),
					prompt: params.history || [],
					metadata: {
						provider: 'cloudflare',
						messageLength: params.message.length,
					},
				});
			}

			const response = await this.provider.callLLM({
				...rest,
				systemPrompt: prompt,
			});

			// OTEL attributes - Token usage
			setAttributes({
				'llm.prompt_tokens': response.usage?.promptTokens || 0,
				'llm.completion_tokens': response.usage?.completionTokens || 0,
				'llm.total_tokens': response.usage?.totalTokens || 0,
				'llm.response_length': response.message?.length || 0,
			});

			// Langfuse - Completion
			if (generation && response.usage) {
				generation.end({
					completion: response.message,
					usage: {
						promptTokens: response.usage.promptTokens,
						completionTokens: response.usage.completionTokens,
						totalTokens: response.usage.totalTokens,
					},
				});
			}

			return response;
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
export const llmService = new AIService(env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_GATEWAY_ID, env.CLOUDFLARE_API_TOKEN);
export type { AIProvider, AIResponse, Message } from './types';
