import type { STTProvider, STTTranscribeOptions } from '../types';

export function createCloudflareProvider(): STTProvider {
	const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	const apiToken = process.env.CLOUDFLARE_API_TOKEN;

	return {
		name: 'cloudflare',
		get isAvailable(): boolean {
			return !!(accountId && apiToken);
		},

		async transcribe(audioBase64: string, _options?: STTTranscribeOptions): Promise<string | null> {
			const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/openai/whisper-large-v3-turbo`;

			try {
				const response = await fetch(url, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${apiToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ audio: audioBase64 }),
					signal: AbortSignal.timeout(30000),
				});

				if (!response.ok) return null;

				const data = (await response.json()) as { result?: { text?: string }; success: boolean };
				if (!data.success || !data.result?.text) return null;

				return data.result.text;
			} catch {
				return null;
			}
		},
	};
}
