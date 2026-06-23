import { createCloudflareProvider } from './providers/cloudflare';
import { createGroqProvider } from './providers/groq';
import { createLocalProvider } from './providers/local';
import { createSTTRouter } from './stt-router';

const GROQ_ENABLED = process.env.STT_GROQ_ENABLED === 'true';

/**
 * Create the default STT router with all available providers.
 * Providers are ordered by priority: Local → Cloudflare → Groq
 * Groq só é incluído se STT_GROQ_ENABLED=true (desativado por padrão).
 */
export function createDefaultSTTRouter() {
	const providers = [createLocalProvider(), createCloudflareProvider()];

	if (GROQ_ENABLED) {
		providers.push(createGroqProvider());
	}

	return createSTTRouter(providers);
}

export { createSTTRouter } from './stt-router';
export { createCloudflareProvider } from './providers/cloudflare';
export { createGroqProvider } from './providers/groq';
export { createLocalProvider } from './providers/local';
export type { STTProvider, STTResult, STTTranscribeOptions, STTProviderConfig } from './types';
