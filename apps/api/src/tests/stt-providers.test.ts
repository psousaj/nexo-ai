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
		vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'test-account');
		vi.stubEnv('CLOUDFLARE_API_TOKEN', 'test-token');

		try {
			const { createCloudflareProvider } = await import('@/core/stt/providers/cloudflare');

			const provider = createCloudflareProvider();

			// Mock fetch to reject
			const mockFetch = vi.fn().mockRejectedValue(new Error('network error'));
			vi.stubGlobal('fetch', mockFetch);

			const result = await provider.transcribe('dGVzdCBhdWRpbw==');
			expect(result).toBeNull();
		} finally {
			vi.unstubAllEnvs();
			vi.unstubAllGlobals();
		}
	});
});

describe('Local Whisper Provider', () => {
	it('reports unavailable when no whisper binary is found', async () => {
		vi.stubEnv('LOCAL_WHISPER_BINARY', '/nonexistent/whisper-binary');

		try {
			const { createLocalProvider } = await import('@/core/stt/providers/local');
			const provider = createLocalProvider();
			expect(provider.name).toBe('local');
			expect(provider.isAvailable).toBe(false);
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it('returns null when provider is not available', async () => {
		vi.stubEnv('LOCAL_WHISPER_BINARY', '/nonexistent/whisper-binary');

		try {
			const { createLocalProvider } = await import('@/core/stt/providers/local');
			const provider = createLocalProvider();
			const result = await provider.transcribe('dGVzdCBhdWRpbw==');
			expect(result).toBeNull();
		} finally {
			vi.unstubAllEnvs();
		}
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
		vi.stubEnv('GROQ_API_KEY', 'test-key');

		try {
			const { createGroqProvider } = await import('@/core/stt/providers/groq');

			const provider = createGroqProvider();

			const mockFetch = vi.fn().mockRejectedValue(new Error('network error'));
			vi.stubGlobal('fetch', mockFetch);

			const result = await provider.transcribe('dGVzdCBhdWRpbw==');
			expect(result).toBeNull();
		} finally {
			vi.unstubAllEnvs();
			vi.unstubAllGlobals();
		}
	});
});

describe('parseWhisperStdout', () => {
	it('extrai texto de linhas com timestamp', async () => {
		const { parseWhisperStdout } = await import('@/core/stt/providers/local');
		const result = parseWhisperStdout('[00:00:00.000 --> 00:00:05.000]  Olá, tudo bem?');
		expect(result).toBe('Olá, tudo bem?');
	});

	it('junta múltiplas linhas', async () => {
		const { parseWhisperStdout } = await import('@/core/stt/providers/local');
		const result = parseWhisperStdout(
			'[00:00:00.000 --> 00:00:03.000]  Primeira frase\n[00:00:03.000 --> 00:00:06.000]  Segunda frase',
		);
		expect(result).toBe('Primeira frase Segunda frase');
	});

	it('ignora linhas de log sem timestamp', async () => {
		const { parseWhisperStdout } = await import('@/core/stt/providers/local');
		const result = parseWhisperStdout(
			'whisper_init: loading model...\n[00:00:00.000 --> 00:00:03.000]  Só esta linha importa',
		);
		expect(result).toBe('Só esta linha importa');
	});

	it('retorna string vazia se não houver linhas com timestamp', async () => {
		const { parseWhisperStdout } = await import('@/core/stt/providers/local');
		const result = parseWhisperStdout('whisper_init: carregando...\nwhisper: done');
		expect(result).toBe('');
	});

	it('retorna string vazia para stdout vazio', async () => {
		const { parseWhisperStdout } = await import('@/core/stt/providers/local');
		expect(parseWhisperStdout('')).toBe('');
	});
});
