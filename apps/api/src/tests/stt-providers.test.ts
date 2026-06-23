import { describe, expect, it, vi } from 'vitest';

describe('Cloudflare STT Provider', () => {
	it('reports unavailable when env vars are missing', async () => {
		const { createCloudflareProvider } = await import('@/core/stt/providers/cloudflare');
		vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '');
		vi.stubEnv('CLOUDFLARE_API_TOKEN', '');
		const provider = createCloudflareProvider();
		expect(provider.name).toBe('cloudflare');
		expect(provider.isAvailable).toBe(false);
		vi.unstubAllEnvs();
	});

	it('returns null on fetch failure', async () => {
		const { createCloudflareProvider } = await import('@/core/stt/providers/cloudflare');
		vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'test-account');
		vi.stubEnv('CLOUDFLARE_API_TOKEN', 'test-token');

		const provider = createCloudflareProvider();

		// Mock fetch to reject
		const mockFetch = vi.fn().mockRejectedValue(new Error('network error'));
		vi.stubGlobal('fetch', mockFetch);

		const result = await provider.transcribe('dGVzdCBhdWRpbw==');
		expect(result).toBeNull();

		vi.unstubAllGlobals();
	});
});

describe('Local Whisper Provider', () => {
	it('reports unavailable when no whisper binary is found', async () => {
		const { createLocalProvider } = await import('@/core/stt/providers/local');
		const provider = createLocalProvider();
		expect(provider.name).toBe('local');
		expect(provider.isAvailable).toBe(false);
	});

	it('returns null when provider is not available', async () => {
		const { createLocalProvider } = await import('@/core/stt/providers/local');
		const provider = createLocalProvider();
		const result = await provider.transcribe('dGVzdCBhdWRpbw==');
		expect(result).toBeNull();
	});
});

describe('Groq STT Provider', () => {
	it('reports unavailable when GROQ_API_KEY is missing', async () => {
		const { createGroqProvider } = await import('@/core/stt/providers/groq');
		const provider = createGroqProvider();
		expect(provider.name).toBe('groq');
		expect(provider.isAvailable).toBe(false);
	});

	it('returns null on fetch failure', async () => {
		const { createGroqProvider } = await import('@/core/stt/providers/groq');
		vi.stubEnv('GROQ_API_KEY', 'test-key');

		const provider = createGroqProvider();

		const mockFetch = vi.fn().mockRejectedValue(new Error('network error'));
		vi.stubGlobal('fetch', mockFetch);

		const result = await provider.transcribe('dGVzdCBhdWRpbw==');
		expect(result).toBeNull();

		vi.unstubAllGlobals();
	});
});
