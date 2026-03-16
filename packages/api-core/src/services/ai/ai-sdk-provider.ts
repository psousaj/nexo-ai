import { env } from '@/config/env';
import { loggers } from '@/utils/logger';
import { createAiGateway } from 'ai-gateway-provider';
import { createUnified } from 'ai-gateway-provider/providers/unified';

/**
 * AI SDK provider usando Cloudflare AI Gateway (OpenAI-compatible endpoint).
 *
 * O AI Gateway gerencia automaticamente:
 * - Fallback entre providers (via Dynamic Routes)
 * - Retry automático (até 5 tentativas)
 * - Cache, rate limiting, analytics
 */

const DEFAULT_MODEL = 'dynamic/nexo';

let _provider: ReturnType<typeof createAiGateway> | null = null;
let _unified: ReturnType<typeof createUnified> | null = null;

function getProvider() {
	if (_provider) return _provider;
	_provider = createAiGateway({
		accountId: env.CLOUDFLARE_ACCOUNT_ID,
		gateway: env.CLOUDFLARE_GATEWAY_ID,
		apiKey: env.CLOUDFLARE_API_TOKEN,
	});

	loggers.ai.info(
		`✅ AI Gateway provider configurado: ${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_GATEWAY_ID}`,
	);
	return _provider;
}

function getUnifiedProvider() {
	if (_unified) return _unified;
	_unified = createUnified();
	return _unified;
}

/**
 * Retorna model reference do AI SDK para uso com streamText/generateText/etc.
 * @param modelId - ID do modelo (default: 'dynamic/nexo')
 */
export function getModel(modelId: string = DEFAULT_MODEL) {
	return getProvider()(getUnifiedProvider()(modelId));
}
