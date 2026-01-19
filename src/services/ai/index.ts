import { env } from '@/config/env';
import { AGENT_SYSTEM_PROMPT } from '@/config/prompts';
import { loggers } from '@/utils/logger';
import { CloudflareProvider } from './cloudflare-provider';
import { GeminiProvider } from './gemini-provider';
import type { AIProvider, AIProviderType, AIResponse, Message } from './types';

/**
 * Serviço AI multi-provider com fallback automático
 *
 * Ordem de prioridade:
 * 1. Gemini (default - mais rápido e barato)
 * 2. Cloudflare Workers AI (fallback quando Gemini falha com 4xx/5xx)
 */
export class AIService {
	private providers: Map<AIProviderType, AIProvider>;
	private defaultProvider: AIProviderType;
	private currentProvider: AIProviderType;

	constructor(defaultProvider: AIProviderType = 'gemini') {
		this.providers = new Map();
		this.defaultProvider = defaultProvider;
		this.currentProvider = defaultProvider;

		// Inicializa providers disponíveis (na ordem de prioridade)
		if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
			this.providers.set(
				'cloudflare',
				new CloudflareProvider(env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_API_TOKEN, '@cf/meta/llama-4-scout-17b-16e-instruct')
			);
			loggers.ai.info('✅ Cloudflare Workers AI configurado');
		} else {
			loggers.ai.info('Cloudflare Workers AI não configurado (faltam CLOUDFLARE_ACCOUNT_ID ou CLOUDFLARE_API_TOKEN)');
		}

		if (env.GOOGLE_API_KEY) {
			this.providers.set('gemini', new GeminiProvider(env.GOOGLE_API_KEY));
			loggers.ai.info('✅ Google Gemini configurado');
		} else {
			loggers.ai.info('Google Gemini não configurado (falta GOOGLE_API_KEY)');
		}

		// Lista providers disponíveis
		const available = Array.from(this.providers.keys());
		loggers.ai.info(`🤖 Providers disponíveis: [${available.join(', ')}]`);

		// Valida que pelo menos um provider está disponível
		if (this.providers.size === 0) {
			loggers.ai.error('❌ Nenhum provider de IA configurado! Configure CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN ou GOOGLE_API_KEY');
		}

		// Valida que o provider default existe
		if (!this.providers.has(defaultProvider)) {
			const available = Array.from(this.providers.keys())[0];
			if (available) {
				loggers.ai.warn(`⚠️ Provider '${defaultProvider}' não disponível. Usando '${available}' como default.`);
				this.defaultProvider = available;
				this.currentProvider = available;
			}
		}
	}

	/**
	 * Chama o LLM com contexto da conversação e fallback automático
	 */
	async callLLM(params: { message: string; history?: Message[]; systemPrompt?: string }): Promise<AIResponse> {
		const { systemPrompt, ...rest } = params;
		const prompt = systemPrompt || AGENT_SYSTEM_PROMPT;

		loggers.ai.info(`🚀 Chamando ${this.currentProvider}`);
		loggers.ai.info(`📩 Mensagem: "${params.message.substring(0, 100)}${params.message.length > 100 ? '...' : ''}"`);
		loggers.ai.info(`📜 Histórico: ${params.history?.length || 0} mensagens`);

		// Tenta com o provider atual
		const provider = this.providers.get(this.currentProvider);
		if (!provider) {
			loggers.ai.error('❌ Nenhum provider disponível');
			return {
				message: '⚠️ Nenhum serviço de IA disponível. Configure CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN ou GOOGLE_API_KEY no .env',
			};
		}

		try {
			const response = await provider.callLLM({
				...rest,
				systemPrompt: prompt,
			});

			loggers.ai.info(`✨ Resposta de ${this.currentProvider} (${response.message.length} chars)`);

			// Se sucesso, mantém o provider atual
			return response;
		} catch (error: any) {
			loggers.ai.error({ err: error }, `❌ Erro no provider ${this.currentProvider}`);

			// Verifica se é erro que deve fazer fallback
			const status = error?.status || error?.response?.status;
			const isRateLimit = error?.message?.toLowerCase().includes('rate limit') || error?.message?.toLowerCase().includes('quota');
			const isHttpError = status && status >= 400 && status < 600;

			loggers.ai.info(`🔍 Análise do erro: status=${status}, isRateLimit=${isRateLimit}, isHttpError=${isHttpError}`);

			const shouldFallback = isHttpError || isRateLimit;

			if (shouldFallback) {
				// Tenta fallback para outro provider
				const fallbackProvider = this.getFallbackProvider();
				if (fallbackProvider) {
					loggers.ai.info(
						`🔄 Erro ${status || 'rate limit'} detectado em ${this.currentProvider}. Tentando fallback para ${fallbackProvider}`
					);
					const originalProvider = this.currentProvider;
					this.currentProvider = fallbackProvider;
					try {
						const fallbackResponse = await this.callLLM({ ...rest, systemPrompt: prompt });
						loggers.ai.info(`✅ Fallback para ${fallbackProvider} foi bem-sucedido!`);
						return fallbackResponse;
					} catch (fallbackError) {
						// Se fallback também falhar, restaura provider original
						loggers.ai.error({ err: fallbackError }, `❌ Fallback para ${fallbackProvider} também falhou`);
						this.currentProvider = originalProvider;
						throw fallbackError;
					}
				}
			}

			// Sem fallback disponível ou erro não é HTTP
			loggers.ai.error('❌ Nenhum fallback disponível ou erro não recuperável');
			return {
				message: '⚠️ Serviço de IA temporariamente indisponível. Tente novamente em alguns instantes.',
			};
		}
	}

	/**
	 * Retorna um provider alternativo disponível
	 */
	private getFallbackProvider(): AIProviderType | null {
		const available = Array.from(this.providers.keys());
		const fallback = available.find((p) => p !== this.currentProvider);
		loggers.ai.info(
			`Buscando fallback. Disponíveis: [${available.join(', ')}], Atual: ${this.currentProvider}, Fallback: ${fallback || 'nenhum'}`
		);
		return fallback || null;
	}

	/**
	 * Força o uso de um provider específico
	 */
	setProvider(provider: AIProviderType): void {
		if (!this.providers.has(provider)) {
			throw new Error(`Provider '${provider}' não está configurado`);
		}
		this.currentProvider = provider;
		loggers.ai.info(`🔄 Provider alterado para: ${provider}`);
	}

	/**
	 * Retorna o provider ativo
	 */
	getCurrentProvider(): AIProviderType {
		return this.currentProvider;
	}

	/**
	 * Lista providers disponíveis
	 */
	getAvailableProviders(): AIProviderType[] {
		return Array.from(this.providers.keys());
	}
}

// Singleton com Gemini como default
export const llmService = new AIService('gemini');
export type { AIProvider, AIProviderType, AIResponse, Message } from './types';
