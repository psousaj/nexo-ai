import { env } from '@/config/env';
import { loggers } from '@/utils/logger';

/**
 * Serviço de Embeddings usando Cloudflare Workers AI
 * Usa API REST direta (não SDK OpenAI) para evitar bugs de formatação
 */
export class EmbeddingService {
	private accountId: string;
	private apiToken: string;
	// Modelo Cloudflare Workers AI: BGE Small (384 dimensões)
	// Ref: https://developers.cloudflare.com/workers-ai/models/text-embeddings/
	private model: string = '@cf/baai/bge-small-en-v1.5';
	private dimensions: number = 384;

	constructor() {
		if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
			throw new Error('Cloudflare credentials não configuradas para Embeddings');
		}

		this.accountId = env.CLOUDFLARE_ACCOUNT_ID;
		this.apiToken = env.CLOUDFLARE_API_TOKEN;
	}

	/**
	 * Trunca texto para caber no limite do modelo
	 * Cloudflare Workers AI: ~2048 chars safe (512 tokens)
	 */
	private truncateText(text: string, maxChars: number = 2000): string {
		if (text.length <= maxChars) return text;

		// Trunca e adiciona indicador
		const truncated = text.slice(0, maxChars);
		loggers.enrichment.warn({ originalLength: text.length, truncatedLength: maxChars }, '⚠️ Texto truncado para embedding');

		return truncated + '...';
	}

	/**
	 * Gera embedding para um texto
	 * Usa API REST direta do Cloudflare Workers AI
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

			// Chamar API diretamente (não usar SDK OpenAI - causa bug)
			const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`;

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					text: processedText,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Cloudflare API error (${response.status}): ${errorText}`);
			}

			const data = (await response.json()) as {
				success: boolean;
				result?: { data?: number[][] };
			};

			// Log da resposta para debug
			loggers.enrichment.debug(
				{
					success: data.success,
					hasResult: !!data.result,
					hasData: !!data.result?.data,
				},
				'📦 Resposta da API de embedding',
			);

			// Cloudflare retorna: { success: true, result: { data: [[...embedding...]] } }
			const embedding = data.result?.data?.[0];

			if (!embedding || !Array.isArray(embedding)) {
				throw new Error('Formato de resposta inválido da API Cloudflare');
			}

			// Validar se o embedding não é um vetor de zeros
			const isZeroVector = embedding.every((v: number) => v === 0);
			if (isZeroVector) {
				loggers.enrichment.error(
					{ textLength: processedText.length, model: this.model },
					'❌ API retornou vetor de zeros! Possível problema no modelo',
				);
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

export const embeddingService = new EmbeddingService();
