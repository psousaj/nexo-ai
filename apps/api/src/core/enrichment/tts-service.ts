import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { loggers } from '@/utils/logger';

export class TTSService {
	private apiKey: string | undefined;

	constructor() {
		this.apiKey = process.env.GOOGLE_TTS_API_KEY;
	}

	get isAvailable(): boolean {
		return !!this.apiKey;
	}

	async synthesize(text: string): Promise<Buffer | null> {
		if (!this.isAvailable) return null;

		try {
			const client = new TextToSpeechClient({ apiKey: this.apiKey });

			const [response] = await client.synthesizeSpeech({
				input: { text: text.slice(0, 5000) },
				voice: { languageCode: 'pt-BR', name: 'pt-BR-Neural2-A' },
				audioConfig: { audioEncoding: 'MP3' },
			});

			if (!response.audioContent) return null;

			const buffer = Buffer.from(response.audioContent as Uint8Array);
			loggers.enrichment.info({ bytes: buffer.length }, 'TTS: Google Cloud success');
			return buffer;
		} catch (error) {
			loggers.enrichment.error({ err: error }, 'TTS: Google Cloud error');
			return null;
		}
	}
}

export const ttsService = new TTSService();
