import { env } from '@/config/env';
import OpenAI from 'openai';
import { loggers } from '@/utils/logger';

/**
 * Serviço de Embeddings usando Cloudflare Workers AI
 * Suporta modelos sugeridos pelo usuário
 */
export class EmbeddingService {
	private client: OpenAI;
	// Modelo padrão: Qwen 2.5 Embedding (excelente para múltiplos idiomas)
	private model: string = '@cf/qwen/qwen2.5-embedding-0.6b';

	constructor() {
		if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
			throw new Error('Cloudflare credentials não configuradas para Embeddings');
		}

		this.client = new OpenAI({
			apiKey: env.CLOUDFLARE_API_TOKEN,
			baseURL: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
		});
	}

	/**
	 * Gera embedding para um texto
	 */
	async generateEmbedding(text: string): Promise<number[]> {
		try {
			const response = await this.client.embeddings.create({
				model: this.model,
				input: text,
			});

			loggers.enrichment.info({ response }, 'Resposta bruta da API de Embedding');

			return response.data[0].embedding;
		} catch (error) {
			loggers.enrichment.error({ err: error }, 'Erro ao gerar embedding');
			throw error;
		}
	}
}

export const embeddingService = new EmbeddingService();
