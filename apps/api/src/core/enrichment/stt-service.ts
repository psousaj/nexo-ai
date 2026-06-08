import { loggers } from '@/utils/logger';

interface CloudflareAIResponse {
	result: { text?: string };
	success: boolean;
}

export class STTService {
	private accountId: string | undefined;
	private apiToken: string | undefined;

	constructor() {
		this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
		this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
	}

	get isAvailable(): boolean {
		return !!(this.accountId && this.apiToken);
	}

	async transcribe(audioBase64: string): Promise<string | null> {
		if (!this.isAvailable) {
			loggers.enrichment.warn('Cloudflare STT não configurado (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN)');
			return null;
		}

		try {
			const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/@cf/openai/whisper-large-v3-turbo`;
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ audio: audioBase64 }),
				signal: AbortSignal.timeout(30000),
			});

			const data = (await response.json()) as CloudflareAIResponse;
			if (!data.success || !data.result?.text) return null;
			return data.result.text;
		} catch (error) {
			loggers.enrichment.error({ err: error }, 'STT: erro ao transcrever áudio');
			return null;
		}
	}
}

export const sttService = new STTService();
