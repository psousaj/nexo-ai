import { loggers } from '@/utils/logger';

interface CFResponse {
	result: { audio?: string };
	success: boolean;
}

export class TTSService {
	private accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	private apiToken = process.env.CLOUDFLARE_API_TOKEN;

	get isAvailable(): boolean {
		return !!(this.accountId && this.apiToken);
	}

	async synthesize(text: string): Promise<Buffer | null> {
		if (!this.isAvailable) return null;

		try {
			const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/@cf/myshell-ai/melotts`;
			const res = await fetch(url, {
				method: 'POST',
				headers: { Authorization: `Bearer ${this.apiToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: text, lang: 'pt-BR' }),
				signal: AbortSignal.timeout(30000),
			});

			const data = (await res.json()) as CFResponse;
			if (!data.success || !data.result?.audio) {
				loggers.enrichment.warn('TTS: Cloudflare fail');
				return null;
			}

			return Buffer.from(data.result.audio, 'base64');
		} catch (err) {
			loggers.enrichment.error({ err }, 'TTS: error');
			return null;
		}
	}
}

export const ttsService = new TTSService();
