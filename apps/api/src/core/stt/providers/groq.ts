import type { STTProvider, STTTranscribeOptions } from '../types';

export function createGroqProvider(): STTProvider {
	const apiKey = process.env.GROQ_API_KEY;
	const model = process.env.STT_GROQ_MODEL || 'whisper-large-v3-turbo';

	return {
		name: 'groq',
		get isAvailable(): boolean {
			return !!apiKey;
		},

		async transcribe(audioBase64: string, options?: STTTranscribeOptions): Promise<string | null> {
			try {
				// Decode base64 to buffer for Groq's multipart API
				const buffer = Buffer.from(audioBase64, 'base64');

				// Determine filename and type from options or default
				const filename = options?.filename || 'audio.webm';
				const mimeType = options?.mimeType || 'audio/webm';

				const formData = new FormData();
				const blob = new Blob([buffer], { type: mimeType });
				formData.append('file', blob, filename);
				formData.append('model', model);

				if (options?.languageHint) {
					formData.append('language', options.languageHint);
				}

				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 30000);

				try {
					const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
						method: 'POST',
						headers: {
							Authorization: `Bearer ${apiKey}`,
						},
						body: formData,
						signal: controller.signal,
					});

					if (!response.ok) {
						return null;
					}

					const result = (await response.json()) as { text: string };
					return result.text?.trim() || null;
				} finally {
					clearTimeout(timeout);
				}
			} catch {
				return null;
			}
		},
	};
}
