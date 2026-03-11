import { env } from '@/config/env';
import { Langfuse } from 'langfuse';

let langfuse: Langfuse | null = null;

export function initializeLangfuse() {
	if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) {
		console.log('[Langfuse] Not configured - skipping');
		return;
	}

	langfuse = new Langfuse({
		publicKey: env.LANGFUSE_PUBLIC_KEY,
		secretKey: env.LANGFUSE_SECRET_KEY,
		baseUrl: env.LANGFUSE_BASE_URL || env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
	});

	console.log('[Langfuse] Initialized');
}

export function getLangfuse() {
	return langfuse;
}

export async function flushLangfuse() {
	await langfuse?.flushAsync();
}

export async function shutdownLangfuse() {
	if (!langfuse) return;

	await langfuse.flushAsync();

	if (typeof (langfuse as any).shutdown === 'function') {
		await Promise.resolve((langfuse as any).shutdown());
		return;
	}

	if (typeof (langfuse as any).shutdownAsync === 'function') {
		await (langfuse as any).shutdownAsync();
	}
}

// Shutdown hook
if (typeof process !== 'undefined') {
	process.on('beforeExit', async () => {
		await shutdownLangfuse();
	});
}
