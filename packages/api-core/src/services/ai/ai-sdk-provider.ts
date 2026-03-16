import { env } from '@/config/env';
import { loggers } from '@/utils/logger';
import { createOpenAI } from '@ai-sdk/openai';

/**
 * AI SDK provider usando Cloudflare AI Gateway (OpenAI-compatible endpoint).
 *
 * O AI Gateway gerencia automaticamente:
 * - Fallback entre providers (via Dynamic Routes)
 * - Retry automático (até 5 tentativas)
 * - Cache, rate limiting, analytics
 */

const DEFAULT_MODEL = 'dynamic/nexo';

let _provider: ReturnType<typeof createOpenAI> | null = null;

function getProvider() {
	if (_provider) return _provider;

	const baseURL = `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_GATEWAY_ID}/compat`;

	_provider = createOpenAI({
		baseURL,
		apiKey: env.CLOUDFLARE_API_TOKEN,
		compatibility: 'compatible',
	});

	loggers.ai.info(`✅ AI SDK provider configurado: ${baseURL}`);
	return _provider;
}

/**
 * Retorna model reference do AI SDK para uso com streamText/generateText/etc.
 * @param modelId - ID do modelo (default: 'dynamic/nexo')
 */
export function getModel(modelId: string = DEFAULT_MODEL) {
	return getProvider()(modelId);
}
