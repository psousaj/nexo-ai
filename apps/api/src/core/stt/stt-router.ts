import type { STTProvider, STTTranscribeOptions } from './types';

export interface STTRouter {
	transcribe(audioBase64: string, options?: STTTranscribeOptions): Promise<string | null>;
	getAvailableProviders(): string[];
}

export function createSTTRouter(providers: STTProvider[]): STTRouter {
	const available = providers.filter((p) => p.isAvailable);

	return {
		async transcribe(audioBase64: string, options?: STTTranscribeOptions): Promise<string | null> {
			for (const provider of available) {
				try {
					const result = await provider.transcribe(audioBase64, options);
					if (result !== null) {
						return result;
					}
				} catch {
					// Provider failed — try next
				}
			}
			return null;
		},

		getAvailableProviders(): string[] {
			return available.map((p) => p.name);
		},
	};
}
