import { loggers } from '@/utils/logger';

interface CloudflareAIResponse {
	result: { audio?: string };
	success: boolean;
}

export class TTSService {
	private accountId: string | undefined;
	private apiToken: string | undefined;

	constructor() {
		this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
		this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
	}

	get isAvailable(): boolean {
		return !!(this.accountId && this.apiToken);
	}

	async synthesize(text: string): Promise<Buffer | null> {
		if (!this.isAvailable) {
			loggers.enrichment.warn('Cloudflare TTS não configurado (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN)');
			return null;
		}

		try {
			const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/@cf/myshell-ai/melotts`;
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ text, lang: 'pt-BR' }),
				signal: AbortSignal.timeout(30000),
			});

			const data = (await response.json()) as CloudflareAIResponse;
			if (!data.success || !data.result?.audio) return null;
			return Buffer.from(data.result.audio, 'base64');
		} catch (error) {
			loggers.enrichment.error({ err: error }, 'TTS: erro ao sintetizar voz');
			return null;
		}
	}
}

export const ttsService = new TTSService();
