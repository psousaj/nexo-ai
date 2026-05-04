/**
 * Edge TTS Service — Text-to-Speech usando Microsoft Edge TTS API
 *
 * Gratuito, sem API key, suporta pt-BR nativamente.
 * Usa a API HTTP do Edge Online que gera áudio Opus (.ogg) para Telegram
 * e MP3 para outros canais.
 */
import { env } from "@/config/env";
import { loggers } from "@/utils/logger";
import { instrumentService } from "@/services/service-instrumentation";

export interface TTSResult {
	audioBuffer: Buffer;
	mimeType: string;
	filename: string;
}

export interface TTSOptions {
	voice?: string;
	rate?: string;
	volume?: string;
	outputFormat?: "ogg_opus" | "mp3" | "webm_opus";
}

const DEFAULT_VOICE = "pt-BR-FranciscaNeural";
const DEFAULT_FORMAT = "ogg_opus";

export class EdgeTTSService {
	private readonly baseUrl = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
	private readonly trustedClientToken = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
	private readonly defaultVoice: string;
	private readonly defaultFormat: string;

	constructor() {
		this.defaultVoice = env.EDGE_TTS_VOICE ?? DEFAULT_VOICE;
		this.defaultFormat = DEFAULT_FORMAT;
	}

	async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
		if (!text || text.trim().length === 0) {
			throw new Error("Text cannot be empty for TTS synthesis");
		}

		// Truncate text to avoid exceeding limits (Edge TTS handles ~5000 chars)
		const processedText = text.length > 5000 ? text.substring(0, 5000) + "..." : text;
		const voice = options?.voice ?? this.defaultVoice;
		const format = options?.outputFormat ?? this.defaultFormat;
		const rate = options?.rate ?? "+0%";
		const volume = options?.volume ?? "+0%";

		const mimeType = format === "mp3" ? "audio/mpeg" : format === "webm_opus" ? "audio/webm" : "audio/ogg; codecs=opus";
		const extension = format === "mp3" ? "mp3" : format === "webm_opus" ? "webm" : "ogg";

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 30_000);

		try {
			const ssml = this.buildSSML(processedText, voice, rate, volume);
			const encodedSSML = encodeURIComponent(ssml);

			const url = `${this.baseUrl}.TrustedDirect?ConnectionId=${this.generateConnectionId()}&SecAccessToken=${this.trustedClientToken}`;

			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/ssml+xml",
					"X-Microsoft-OutputFormat": format,
					"User-Agent": "NexoTTS/1.0",
				},
				body: ssml,
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Edge TTS API error: ${response.status} ${errorText}`);
			}

			const audioBuffer = Buffer.from(await response.arrayBuffer());

			if (audioBuffer.length < 100) {
				throw new Error("Edge TTS returned empty or invalid audio");
			}

			loggers.ai.info(
				{ textLength: processedText.length, voice, format, audioSize: audioBuffer.length },
				"🔊 TTS synthesis completed",
			);

			return {
				audioBuffer,
				mimeType,
				filename: `voice.${extension}`,
			};
		} catch (error: unknown) {
			if (error instanceof Error && error.name === "AbortError") {
				throw new Error("Edge TTS API timed out after 30s");
			}
			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}

	private buildSSML(text: string, voice: string, rate: string, volume: string): string {
		return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="pt-BR">
  <voice name="${voice}">
    <prosody rate="${rate}" volume="${volume}">
      ${this.escapeXml(text)}
    </prosody>
  </voice>
</speak>`;
	}

	private escapeXml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&apos;");
	}

	private generateConnectionId(): string {
		return "xxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, () =>
			Math.floor(Math.random() * 16).toString(16),
		);
	}
}

export const edgeTTSService = instrumentService("edge-tts", new EdgeTTSService());