import edgeTTS from 'edge-tts';
import { loggers } from '@/utils/logger';

const VOICE = 'pt-BR-AntonioNeural';

export class TTSService {
	get isAvailable(): boolean {
		return true; // Edge TTS is always available, no API key needed
	}

	async synthesize(text: string): Promise<Buffer | null> {
		try {
			const tts = edgeTTS.createVoiceStream({ voice: VOICE });

			const chunks: Buffer[] = [];
			for await (const chunk of tts.stream(text)) {
				if (chunk.type === 'audio') {
					chunks.push(chunk.data);
				}
			}

			if (chunks.length === 0) return null;

			const audioBuffer = Buffer.concat(chunks);
			loggers.enrichment.info({ bytes: audioBuffer.length }, 'TTS: Edge TTS audio generated');
			return audioBuffer;
		} catch (error) {
			loggers.enrichment.error({ err: error }, 'TTS: Edge TTS error');
			return null;
		}
	}
}

export const ttsService = new TTSService();
