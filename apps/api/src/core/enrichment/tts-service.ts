import { tts } from 'edge-tts';
import { loggers } from '@/utils/logger';

const VOICE = 'pt-BR-AntonioNeural';

export class TTSService {
	get isAvailable(): boolean {
		return true;
	}

	async synthesize(text: string): Promise<Buffer | null> {
		try {
			const audioBuffer = await tts(text, { voice: VOICE });
			loggers.enrichment.info({ bytes: audioBuffer.length }, 'TTS: Edge TTS audio generated');
			return audioBuffer;
		} catch (error) {
			loggers.enrichment.error({ err: error }, 'TTS: Edge TTS error');
			return null;
		}
	}
}

export const ttsService = new TTSService();
