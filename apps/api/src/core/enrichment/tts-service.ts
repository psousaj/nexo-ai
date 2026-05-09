import { GoogleGenAI } from '@google/genai';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { loggers } from '@/utils/logger';

const require = createRequire(import.meta.url);
const VOICE = 'Algenib';
const MODEL = 'gemini-3.1-flash-tts-preview';

function pcmToOpus(pcm: Buffer, sampleRate = 24000): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const ffmpegPath = require('ffmpeg-static') as string;
		const ffmpeg = spawn(ffmpegPath, [
			'-f', 's16le', '-ar', String(sampleRate), '-ac', '1', '-i', 'pipe:0',
			'-c:a', 'libopus', '-b:a', '32k', '-f', 'ogg', 'pipe:1',
		]);

		const chunks: Buffer[] = [];
		ffmpeg.stdout.on('data', (c: Buffer) => chunks.push(c));
		ffmpeg.stderr.on('data', () => {});
		ffmpeg.on('close', (code: number) => {
			if (code === 0) resolve(Buffer.concat(chunks));
			else reject(new Error(`ffmpeg exit ${code}`));
		});
		ffmpeg.on('error', reject);

		ffmpeg.stdin.write(pcm);
		ffmpeg.stdin.end();
	});
}

export class TTSService {
	private apiKey = process.env.GEMINI_TTS_API_KEY;

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

			const pcm = Buffer.from(base64, 'base64');
			const ogg = await pcmToOpus(pcm);
			loggers.enrichment.info({ bytes: ogg.length }, 'TTS: Gemini + ffmpeg → OGG/OPUS');
			return ogg;
		} catch (error) {
			loggers.enrichment.error({ err: error }, 'TTS: error');
			return null;
		}
	}
}

export const ttsService = new TTSService();
