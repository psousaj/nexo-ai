import { Langfuse } from 'langfuse';
import { env } from '@/config/env';

let langfuse: Langfuse | null = null;

export function initializeLangfuse() {
	if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) {
		console.log('[Langfuse] Not configured - skipping');
		return;
	}

	langfuse = new Langfuse({
		publicKey: env.LANGFUSE_PUBLIC_KEY,
		secretKey: env.LANGFUSE_SECRET_KEY,
		host: env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
	});

	console.log('[Langfuse] Initialized');
}

export function getLangfuse() {
	return langfuse;
}

export async function flushLangfuse() {
	await langfuse?.flushAsync();
}

// Shutdown hook
if (typeof process !== 'undefined') {
	process.on('beforeExit', async () => {
		await flushLangfuse();
	});
}
