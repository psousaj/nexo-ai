import { env } from '@/config/env';
import { instrumentService } from '@/services/service-instrumentation';
import { loggers } from '@/utils/logger';
import OpenAI from 'openai';

/**
 * Serviço de Embeddings usando Cloudflare AI Gateway
 * Usa SDK OpenAI apontando para o endpoint compat do AI Gateway
 *
 * Benefícios:
 * - Cache nativo de embeddings (economia massiva)
 * - Analytics unificado
 * - Rate limiting automático
 */
export class EmbeddingService {
	private client: OpenAI;
	private model = 'dynamic/embeddings';

	constructor() {
		if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_GATEWAY_ID) {
			throw new Error('Cloudflare credentials não configuradas para Embeddings');
		}

		const baseURL = `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_GATEWAY_ID}/compat`;

		this.client = new OpenAI({
			apiKey: env.CLOUDFLARE_API_TOKEN,
			baseURL,
		});

		loggers.enrichment.info('✅ EmbeddingService configurado via AI Gateway');
	}

	/**
	 * Trunca texto para caber no limite do modelo
	 * ~2048 chars safe (512 tokens)
	 */
	private truncateText(text: string, maxChars = 2000): string {
		if (text.length <= maxChars) return text;

		const truncated = text.slice(0, maxChars);
		loggers.enrichment.warn({ originalLength: text.length, truncatedLength: maxChars }, '⚠️ Texto truncado para embedding');

		return `${truncated}...`;
	}

	/**
	 * Gera embedding para um texto
	 * Usa SDK OpenAI via AI Gateway compat endpoint
	 */
	async generateEmbedding(text: string): Promise<number[]> {
		try {
			// Validar entrada
			if (!text || text.trim().length === 0) {
				throw new Error('Texto vazio - não pode gerar embedding');
			}

			// Truncar para caber no limite do modelo
			const processedText = this.truncateText(text);

			loggers.enrichment.debug({ textLength: processedText.length, model: this.model }, '📤 Gerando embedding');

			// Chamar API via OpenAI SDK
			const response = await this.client.embeddings.create({
				model: this.model,
				input: processedText,
			});

			const embedding = response.data[0]?.embedding;

			if (!embedding || !Array.isArray(embedding)) {
				throw new Error('Formato de resposta inválido da API');
			}

			// Validar se o embedding não é um vetor de zeros
			const isZeroVector = embedding.every((v: number) => v === 0);
			if (isZeroVector) {
				loggers.enrichment.error({ textLength: processedText.length, model: this.model }, '❌ API retornou vetor de zeros!');
				throw new Error('Embedding inválido: vetor de zeros retornado');
			}

			const magnitude = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));

			loggers.enrichment.info(
				{
					dimensions: embedding.length,
					sample: embedding.slice(0, 3),
					magnitude: magnitude.toFixed(4),
				},
				'✅ Embedding gerado',
			);

			return embedding;
		} catch (error: any) {
			loggers.enrichment.error(
				{
					err: error,
					textLength: text?.length,
					model: this.model,
					status: error?.status,
				},
				'❌ Erro ao gerar embedding',
			);
			throw error;
		}
	}
}

export const embeddingService = instrumentService('embedding', new EmbeddingService());
