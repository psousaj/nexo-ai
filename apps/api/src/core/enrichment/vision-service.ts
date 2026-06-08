import { loggers } from '@/utils/logger';
import { GoogleGenAI } from '@google/genai';

export class VisionService {
	private apiKey = process.env.GEMINI_TTS_API_KEY; // reusa mesma key do TTS

	get isAvailable(): boolean {
		return !!this.apiKey;
	}

	async describe(base64data: string, mimeType = 'image/jpeg'): Promise<string | null> {
		if (!this.isAvailable) return null;

		try {
			const ai = new GoogleGenAI({ apiKey: this.apiKey });
			const response = await ai.models.generateContent({
				model: 'gemini-2.5-flash',
				contents: [
					{
						parts: [
							{ text: 'Descreva esta imagem em português brasileiro com detalhes relevantes. O que você vê?' },
							{ inlineData: { mimeType, data: base64data } },
						],
					},
				],
			});

			const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
			if (!text) return null;

			loggers.enrichment.info({ len: text.length }, 'Vision: Gemini description generated');
			return text;
		} catch (error) {
			loggers.enrichment.error({ err: error }, 'Vision: Gemini error');
			return null;
		}
	}
}

export const visionService = new VisionService();
