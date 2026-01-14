import OpenAI from 'openai';
import { encode } from '@toon-format/toon';
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
			console.log(`☁️ [Cloudflare] Enviando para ${this.model}`);

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

			// Montar messages no formato padrão OpenAI
			const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

			// System prompt como primeira mensagem (padrão OpenAI)
			if (systemPrompt) {
				messages.push({
					role: 'system',
					content: systemPrompt,
				});
			}

			// Mensagem do usuário com contexto
			messages.push({
				role: 'user',
				content: contextContent,
			});

			// Chamar API usando SDK OpenAI
			// NOTA: response_format pode causar erro 400 em alguns modelos Cloudflare
			const response = await this.client.chat.completions.create({
				model: this.model,
				messages,
			});

			const rawContent = response.choices[0]?.message?.content;
			const text = typeof rawContent === 'string' ? rawContent : '';

			console.log('☁️ [Cloudflare] Resposta recebida');
			if (!text) {
				console.warn('⚠️ [Cloudflare] Resposta vazia!');
			}

			return {
				message: text.trim(),
			};
		} catch (error: any) {
			console.error('❌ [Cloudflare] Erro:', error);
			// Re-throw todos os erros para ativar fallback no AIService
			throw error;
		}
	}

	getName(): string {
		return 'cloudflare';
	}
}
