import { env } from '@/config/env';
import { instrumentService } from '@/services/service-instrumentation';

export interface TranscriptionResult {
	text: string;
	language?: string;
	duration?: number;
}

export class WhisperService {
	private readonly baseURL: string;
	private readonly apiKey: string;
	private readonly model: string;

	constructor() {
		this.baseURL = `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_GATEWAY_ID}/compat`;
		this.apiKey = env.CLOUDFLARE_API_TOKEN;
		this.model = env.WHISPER_MODEL ?? 'whisper-1';
	}

	async transcribeAudio(params: {
		audioBuffer: Buffer;
		filename: string;
		mimeType: string;
		languageHint?: string;
	}): Promise<TranscriptionResult> {
		const formData = new FormData();
		const blob = new Blob([params.audioBuffer], { type: params.mimeType });
		formData.append('file', blob, params.filename);
		formData.append('model', this.model);

		if (params.languageHint) {
			formData.append('language', params.languageHint);
		}

		formData.append('response_format', 'verbose_json');

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 30_000);

		try {
			const response = await fetch(`${this.baseURL}/audio/transcriptions`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: formData,
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Whisper API error: ${response.status} ${errorText}`);
			}

			const result = (await response.json()) as Record<string, unknown>;
			return {
				text: (result.text as string)?.trim() ?? '',
				language: result.language as string | undefined,
				duration: result.duration as number | undefined,
			};
		} catch (error: unknown) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error('Whisper API transcription timed out after 30s');
			}
			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}

	async transcribeFromUrl(params: { url: string; languageHint?: string }): Promise<TranscriptionResult> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 15_000);

		try {
			const audioResponse = await fetch(params.url, { signal: controller.signal });
			if (!audioResponse.ok) {
				throw new Error(`Failed to download audio: ${audioResponse.status}`);
			}
			const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
			const contentType = audioResponse.headers.get('content-type') ?? 'audio/ogg';
			const extension = contentType.includes('webm')
				? 'webm'
				: contentType.includes('mp4')
					? 'mp4'
					: contentType.includes('mpeg')
						? 'mp3'
						: 'ogg';

			clearTimeout(timeout);
			return await this.transcribeAudio({
				audioBuffer,
				filename: `audio.${extension}`,
				mimeType: contentType,
				languageHint: params.languageHint,
			});
		} catch (error: unknown) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error('Audio download timed out after 15s');
			}
			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}
}

export const whisperService = instrumentService('whisper-stt', new WhisperService());
