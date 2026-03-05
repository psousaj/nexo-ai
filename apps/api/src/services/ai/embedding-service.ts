import { env } from '@/config/env';
import { captureException } from '@/sentry';
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
	private model = env.EMBEDDING_MODEL ?? '@cf/baai/bge-small-en-v1.5';
	private readonly timeoutMs = env.EMBEDDING_TIMEOUT_MS ?? 25000;
	private readonly maxRetries = env.EMBEDDING_MAX_RETRIES ?? 4;
	private readonly retryBaseDelayMs = env.EMBEDDING_RETRY_BASE_DELAY_MS ?? 600;
	private readonly retryMaxDelayMs = env.EMBEDDING_RETRY_MAX_DELAY_MS ?? 8000;

	constructor() {
		if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_GATEWAY_ID) {
			throw new Error('Cloudflare credentials não configuradas para Embeddings');
		}

		const baseURL = `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_GATEWAY_ID}/compat`;

		this.client = new OpenAI({
			apiKey: env.CLOUDFLARE_API_TOKEN,
			baseURL,
			maxRetries: 0,
			timeout: this.timeoutMs,
		});

		loggers.enrichment.info(
			{
				model: this.model,
				timeoutMs: this.timeoutMs,
				maxRetries: this.maxRetries,
			},
			'✅ EmbeddingService configurado via AI Gateway',
		);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private backoffDelay(attempt: number): number {
		const exponential = Math.min(this.retryMaxDelayMs, this.retryBaseDelayMs * 2 ** (attempt - 1));
		const jitter = Math.floor(Math.random() * 250);
		return exponential + jitter;
	}

	private extractStatus(error: any): number | undefined {
		if (typeof error?.status === 'number') return error.status;
		if (typeof error?.response?.status === 'number') return error.response.status;
		return undefined;
	}

	private isRetryableError(error: any): boolean {
		const status = this.extractStatus(error);
		if (status === 429) return true;
		if (typeof status === 'number' && status >= 500) return true;

		const code = String(error?.code || error?.cause?.code || '').toUpperCase();
		const retryableCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'ENOTFOUND']);

		return retryableCodes.has(code);
	}

	private async requestEmbedding(input: string): Promise<number[]> {
		const response = await this.client.embeddings.create({
			model: this.model,
			input,
		});

		const embedding = response.data[0]?.embedding;

		if (!embedding || !Array.isArray(embedding)) {
			throw new Error('Formato de resposta inválido da API');
		}

		return embedding;
	}

	/**
	 * Trunca texto para caber no limite do modelo
	 * ~2048 chars safe (512 tokens)
	 */
	private truncateText(text: string, maxChars = 2000): string {
		if (text.length <= maxChars) return text;

		const truncated = text.slice(0, maxChars);
		loggers.enrichment.warn(
			{ originalLength: text.length, truncatedLength: maxChars },
			'⚠️ Texto truncado para embedding',
		);

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

			let embedding: number[] | null = null;

			for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
				try {
					embedding = await this.requestEmbedding(processedText);
					break;
				} catch (error: any) {
					const retryable = this.isRetryableError(error);
					const isLastAttempt = attempt >= this.maxRetries + 1;

					if (!retryable || isLastAttempt) {
						throw error;
					}

					const delayMs = this.backoffDelay(attempt);
					loggers.enrichment.warn(
						{
							attempt,
							delayMs,
							status: this.extractStatus(error),
							model: this.model,
							errCode: error?.code,
						},
						'🔁 Erro transitório ao gerar embedding, retry agendado',
					);

					await this.sleep(delayMs);
				}
			}

			if (!embedding) {
				throw new Error('Falha ao gerar embedding após retries');
			}

			// Validar se o embedding não é um vetor de zeros
			const isZeroVector = embedding.every((v: number) => v === 0);
			if (isZeroVector) {
				loggers.enrichment.error(
					{ textLength: processedText.length, model: this.model },
					'❌ API retornou vetor de zeros!',
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
			captureException(error instanceof Error ? error : new Error(String(error)), {
				provider: 'embedding',
				state: 'generate_embedding',
				model: this.model,
				status: error?.status,
				text_length: text?.length,
			});

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
