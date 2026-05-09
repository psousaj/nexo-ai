import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { loggers } from '@/utils/logger';

const VOICE_ID = '4J31DrhygVjvFsoj7BsM';

export class TTSService {
	private apiKey: string | undefined;

	constructor() {
		this.apiKey = process.env.ELEVENLABS_API_KEY;
	}

	get isAvailable(): boolean {
		return !!this.apiKey;
	}

	async synthesize(text: string): Promise<Buffer | null> {
		if (!this.isAvailable) {
			loggers.enrichment.warn('ElevenLabs TTS não configurado (ELEVENLABS_API_KEY)');
			return null;
		}

		try {
			const client = new ElevenLabsClient({ apiKey: this.apiKey });

			const stream = await client.textToSpeech.convert(VOICE_ID, {
				text,
				modelId: 'eleven_multilingual_v2',
			});

			const chunks: Buffer[] = [];
			for await (const chunk of stream) {
				chunks.push(Buffer.from(chunk));
			}

			const audioBuffer = Buffer.concat(chunks);
			loggers.enrichment.info({ bytes: audioBuffer.length }, 'TTS: ElevenLabs audio generated');
			return audioBuffer;
		} catch (error) {
			loggers.enrichment.error({ err: error }, 'TTS: ElevenLabs error');
			return null;
		}
	}
}

export const ttsService = new TTSService();
