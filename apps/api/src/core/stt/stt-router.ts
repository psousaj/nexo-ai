import { loggers } from '@/utils/logger';
import type { STTProvider, STTTranscribeOptions } from './types';

const log = loggers.enrichment;

export interface STTRouter {
	transcribe(audioBase64: string, options?: STTTranscribeOptions): Promise<string | null>;
	getAvailableProviders(): string[];
}

export function createSTTRouter(providers: STTProvider[]): STTRouter {
	const available = providers.filter((p) => p.isAvailable);

	log.info({ providers: available.map((p) => p.name) }, 'STT router initialized');

	return {
		async transcribe(audioBase64: string, options?: STTTranscribeOptions): Promise<string | null> {
			for (const provider of available) {
				try {
					const result = await provider.transcribe(audioBase64, options);
					if (result !== null) {
						log.info({ provider: provider.name }, 'STT transcription successful');
						return result;
					}
					log.warn({ provider: provider.name }, 'STT provider returned null, trying next');
				} catch (err) {
					log.error({ err, provider: provider.name }, 'STT provider failed');
				}
			}
			log.error('All STT providers failed');
			return null;
		},

		getAvailableProviders(): string[] {
			return available.map((p) => p.name);
		},
	};
}
