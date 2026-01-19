import OpenAI from 'openai';
import { encode } from '@toon-format/toon';
import { loggers } from '@/utils/logger';
import type { AIProvider, AIResponse, Message } from './types';

/**
 * Provider para Cloudflare Workers AI usando SDK OpenAI
 * Usa compatibilidade OpenAI do Workers AI
 * Ref: https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
 *
 * Histórico convertido para TOON para reduzir tokens de entrada
 */
export class CloudflareProvider implements AIProvider {
	private client: OpenAI;
	private model: string;

	constructor(accountId: string, apiToken: string, model: string = '@cf/meta/llama-4-scout-17b-16e-instruct') {
		this.client = new OpenAI({
			apiKey: apiToken,
			baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
		});
		this.model = model;
	}

	async callLLM(params: { message: string; history?: Message[]; systemPrompt?: string }): Promise<AIResponse> {
		const { message, history = [], systemPrompt } = params;

		try {
			loggers.cloudflare.info(`🚀 Enviando para ${this.model}`);

			// Converter histórico para TOON (economiza 30–60% tokens)
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

			// Chamada à API (compat OpenAI do Workers AI)
			const response = await this.client.chat.completions.create({
				model: this.model,
				messages,
			});

			// DEBUG: Log estruturado da resposta
			const rawContent = response.choices[0]?.message?.content;
			const contentType = typeof rawContent;
			let contentPreview = '';
			let contentLength = 0;
			if (typeof rawContent === 'string') {
				contentPreview = rawContent.substring(0, 200);
				contentLength = rawContent.length;
			} else if (rawContent !== undefined && rawContent !== null) {
				contentPreview = JSON.stringify(rawContent).substring(0, 200);
				contentLength = JSON.stringify(rawContent).length;
			}

			loggers.cloudflare.info(
				{
					response: {
						id: response.id,
						model: response.model,
						choices: response.choices.length,
						firstChoice: {
							index: response.choices[0]?.index,
							finishReason: response.choices[0]?.finish_reason,
							messageRole: response.choices[0]?.message?.role,
							contentType,
							contentLength,
							contentPreview,
						},
						usage: response.usage,
					},
				},
				'🔍 [DEBUG] Resposta Cloudflare completa',
			);

			let text = '';
			if (typeof rawContent === 'string') {
				text = rawContent;
			} else if (typeof rawContent === 'object' && rawContent !== null) {
				// Se já veio como objeto, serializa para string JSON
				text = JSON.stringify(rawContent);
			}

			loggers.cloudflare.info({ textLength: text.length, hasText: !!text, contentType }, '📥 Resposta recebida');

			if (!text || text.trim().length === 0) {
				loggers.cloudflare.error(
					{
						rawContent,
						contentType,
						responseChoices: response.choices,
					},
					'⚠️ Resposta vazia ou inválida - modelo não retornou conteúdo string ou objeto!',
				);
				throw new Error('Cloudflare returned empty or invalid response');
			}

			return {
				message: text.trim(),
			};
		} catch (error) {
			loggers.cloudflare.error({ error }, '❌ Erro ao chamar Cloudflare Workers AI');
			throw error;
		}
	}

	getName(): string {
		return 'cloudflare';
	}
}
