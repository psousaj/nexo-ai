import { GoogleGenAI } from '@google/genai';
import { loggers } from '@/utils/logger';

const VOICE = 'Fenrir';
const MODEL = 'gemini-3.1-flash-tts-preview';

export class TTSService {
	private apiKey: string | undefined;

	constructor() {
		this.apiKey = process.env.GEMINI_TTS_API_KEY;
	}

	get isAvailable(): boolean {
		return !!this.apiKey;
	}

	async synthesize(text: string): Promise<Buffer | null> {
		if (!this.isAvailable) return null;

		try {
			const ai = new GoogleGenAI({ apiKey: this.apiKey });

			const response = await ai.models.generateContent({
				model: MODEL,
				contents: [{ parts: [{ text: text.slice(0, 5000) }] }],
				config: {
					responseModalities: ['AUDIO'],
					speechConfig: {
						voiceConfig: {
							prebuiltVoiceConfig: { voiceName: VOICE },
						},
					},
				},
			});

			const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
			if (!base64) return null;

			const buffer = Buffer.from(base64, 'base64');
			loggers.enrichment.info({ bytes: buffer.length }, 'TTS: Gemini success (Fenrir)');
			return buffer;
		} catch (error) {
			loggers.enrichment.error({ err: error }, 'TTS: Gemini error');
			return null;
		}
	}
}

export const ttsService = new TTSService();
