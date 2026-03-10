import { logger } from './logger';

export interface RetryOptions {
	maxRetries?: number;
	delayMs?: number;
	backoffMultiplier?: number;
	onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
	maxRetries: 3,
	delayMs: 1000,
	backoffMultiplier: 2,
	onRetry: () => {},
};

/**
 * Retry logic com exponential backoff
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	let lastError: Error;

	for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error as Error;

			if (attempt === opts.maxRetries) {
				logger.error(
					{
						attempts: attempt,
						error: lastError.message,
					},
					'Max retries reached',
				);
				throw lastError;
			}

			const delay = opts.delayMs * opts.backoffMultiplier ** (attempt - 1);
			opts.onRetry(attempt, lastError);

			logger.warn(
				{
					delay,
					error: lastError.message,
				},
				`Retry attempt ${attempt}/${opts.maxRetries}`,
			);

			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw lastError!;
}

/**
 * Wrapper para APIs externas com retry automático
 */
export async function fetchWithRetry(
	url: string,
	options?: RequestInit,
	retryOptions?: RetryOptions,
): Promise<Response> {
	return withRetry(async () => {
		const response = await fetch(url, options);

		// Retry em erros HTTP 5xx e 429 (rate limit)
		if (response.status >= 500 || response.status === 429) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		return response;
	}, retryOptions);
}
