export interface STTProvider {
	/** Provider name for logging/diagnostics */
	readonly name: string;
	/** Whether this provider is configured (has credentials) */
	get isAvailable(): boolean;
	/**
	 * Transcribe audio to text.
	 * @param audioBase64 - Base64-encoded audio data
	 * @returns Transcription text, or null if failed
	 */
	transcribe(audioBase64: string, options?: STTTranscribeOptions): Promise<string | null>;
}

export interface STTTranscribeOptions {
	languageHint?: string;
	filename?: string;
	mimeType?: string;
}

export interface STTResult {
	text: string;
	provider: string;
	language?: string;
}

export interface STTProviderConfig {
	cloudflare?: { accountId?: string; apiToken?: string };
	groq?: { apiKey?: string; model?: string };
	local?: { model?: string; language?: string };
}

export const STT_ERROR_FALLBACK = '[Áudio não reconhecido]';
