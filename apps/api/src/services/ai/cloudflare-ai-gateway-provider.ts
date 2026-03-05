import { loggers } from '@/utils/logger';
import { observe, updateActiveObservation } from '@langfuse/tracing';
import { encode } from '@toon-format/toon';
import OpenAI from 'openai';
import type { AIProvider, AIResponse, Message } from './types';

/**
 * Provider unificado usando Cloudflare AI Gateway
 * Usa SDK OpenAI apontando para o AI Gateway compat endpoint
 * Ref: https://developers.cloudflare.com/ai-gateway/
 *
 * Benefícios:
 * - Fallback automático via Dynamic Routes
 * - Cache, rate limiting, analytics nativos
 * - Retry automático (até 5 tentativas)
 * - Histórico convertido para TOON (economia de tokens)
 */
export class CloudflareAIGatewayProvider implements AIProvider {
	private client: OpenAI;
	private model: string;

	constructor(accountId: string, gatewayId: string, cfApiToken: string, model = 'dynamic/cloudflare') {
		const baseURL = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/compat`;

		this.client = new OpenAI({
			apiKey: cfApiToken,
			baseURL,
		});
		this.model = model;

		loggers.ai.info(`✅ AI Gateway configurado: ${baseURL} (model: ${model})`);
	}

	getName(): string {
		return 'ai-gateway';
	}

	setModel(model: string): void {
		this.model = model;
		loggers.ai.info(`🔄 Model alterado para: ${model}`);
	}

	async callLLM(params: { message: string; history?: Message[]; systemPrompt?: string }): Promise<AIResponse> {
		const { message, history = [], systemPrompt } = params;
		const startTime = Date.now();

		try {
			loggers.ai.info(`🚀 Enviando para AI Gateway (model: ${this.model})`);

			// Converter histórico para TOON (economiza 30-60% tokens)
			let contextContent = message;

			if (history.length > 0) {
				const historyData = history.map((msg) => ({
					role: msg.role,
					content: msg.content,
				}));

				const toonHistory = encode(historyData, { delimiter: '\t' });

				contextContent = `Histórico da conversa em formato TOON (tab-separated):

\`\`\`toon
${toonHistory}
\`\`\`

Mensagem atual: ${message}`;
			}

			// Montar messages no formato OpenAI
			const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

			if (systemPrompt) {
				messages.push({
					role: 'system',
					content: systemPrompt,
				});
			}

			messages.push({
				role: 'user',
				content: contextContent,
			});

			const tracedGatewayCompletion = observe(
				async (payload: { model: string; messages: OpenAI.Chat.ChatCompletionMessageParam[] }) => {
					updateActiveObservation({
						metadata: {
							provider: 'cloudflare-ai-gateway',
							model: payload.model,
							historyCount: history.length,
							hasSystemPrompt: Boolean(systemPrompt),
						},
					});

					const completion = await this.client.chat.completions.create(payload);

					updateActiveObservation({
						metadata: {
							responseId: completion.id,
							responseModel: completion.model,
							finishReason: completion.choices[0]?.finish_reason || null,
							usage: completion.usage || null,
						},
					});

					return completion;
				},
				{
					name: 'cloudflare-ai-gateway.chat.completions',
					asType: 'generation',
				},
			);

			// Chamada ao AI Gateway - retry e fallback são automáticos
			const response = await tracedGatewayCompletion({
				model: this.model,
				messages,
			});

			const duration = Date.now() - startTime;
			const rawContent = response.choices[0]?.message?.content;

			// Log estruturado
			loggers.ai.info(
				{
					response: {
						id: response.id,
						model: response.model,
						duration,
						usage: response.usage,
					},
				},
				`✨ Resposta do AI Gateway em ${duration}ms`,
			);

			let text = '';
			if (typeof rawContent === 'string') {
				text = rawContent;
			} else if (typeof rawContent === 'object' && rawContent !== null) {
				text = JSON.stringify(rawContent);
			}

			if (!text || text.trim().length === 0) {
				loggers.ai.error({ rawContent }, '⚠️ Resposta vazia do AI Gateway');
				throw new Error('AI Gateway returned empty response');
			}

			return {
				message: text.trim(),
			};
		} catch (error: any) {
			const duration = Date.now() - startTime;
			loggers.ai.error(
				{
					err: error,
					duration,
					model: this.model,
				},
				'❌ Erro no AI Gateway',
			);
			throw error;
		}
	}
}
