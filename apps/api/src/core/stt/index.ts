import { createCloudflareProvider } from './providers/cloudflare';
import { createGroqProvider } from './providers/groq';
import { createSTTRouter } from './stt-router';

/**
 * Create the default STT router with all available providers.
 * Providers are ordered by priority: Cloudflare → Groq
 */
export function createDefaultSTTRouter() {
	return createSTTRouter([createCloudflareProvider(), createGroqProvider()]);
}

export { createSTTRouter } from './stt-router';
export { createCloudflareProvider } from './providers/cloudflare';
export { createGroqProvider } from './providers/groq';
export type { STTProvider, STTResult, STTTranscribeOptions, STTProviderConfig } from './types';
