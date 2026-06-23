import { describe, expect, it, vi } from 'vitest';

describe('STT Router', () => {
	describe('transcribe with fallback', () => {
		it('returns text from first available provider', async () => {
			const { createSTTRouter } = await import('@/core/stt/stt-router');
			const provider1 = {
				name: 'provider1',
				isAvailable: true,
				transcribe: vi.fn().mockResolvedValue('transcrição da provider1'),
			};
			const provider2 = {
				name: 'provider2',
				isAvailable: true,
				transcribe: vi.fn().mockResolvedValue('transcrição da provider2'),
			};

			const router = createSTTRouter([provider1, provider2]);
			const result = await router.transcribe('base64audio');

			expect(result).toBe('transcrição da provider1');
			expect(provider1.transcribe).toHaveBeenCalledOnce();
			expect(provider2.transcribe).not.toHaveBeenCalled();
		});

		it('falls back to next provider when first returns null', async () => {
			const { createSTTRouter } = await import('@/core/stt/stt-router');
			const provider1 = {
				name: 'provider1',
				isAvailable: true,
				transcribe: vi.fn().mockResolvedValue(null),
			};
			const provider2 = {
				name: 'provider2',
				isAvailable: true,
				transcribe: vi.fn().mockResolvedValue('transcrição fallback'),
			};

			const router = createSTTRouter([provider1, provider2]);
			const result = await router.transcribe('base64audio');

			expect(result).toBe('transcrição fallback');
			expect(provider1.transcribe).toHaveBeenCalledOnce();
			expect(provider2.transcribe).toHaveBeenCalledOnce();
		});

		it('returns null when all providers return null', async () => {
			const { createSTTRouter } = await import('@/core/stt/stt-router');
			const provider1 = {
				name: 'provider1',
				isAvailable: true,
				transcribe: vi.fn().mockResolvedValue(null),
			};
			const provider2 = {
				name: 'provider2',
				isAvailable: true,
				transcribe: vi.fn().mockResolvedValue(null),
			};

			const router = createSTTRouter([provider1, provider2]);
			const result = await router.transcribe('base64audio');

			expect(result).toBeNull();
		});

		it('skips unavailable providers', async () => {
			const { createSTTRouter } = await import('@/core/stt/stt-router');
			const provider1 = {
				name: 'provider1',
				isAvailable: false,
				transcribe: vi.fn(),
			};
			const provider2 = {
				name: 'provider2',
				isAvailable: true,
				transcribe: vi.fn().mockResolvedValue('transcrição funcionou'),
			};

			const router = createSTTRouter([provider1, provider2]);
			const result = await router.transcribe('base64audio');

			expect(result).toBe('transcrição funcionou');
			expect(provider1.transcribe).not.toHaveBeenCalled();
			expect(provider2.transcribe).toHaveBeenCalledOnce();
		});

		it('passes options to provider transcribe', async () => {
			const { createSTTRouter } = await import('@/core/stt/stt-router');
			const provider = {
				name: 'provider',
				isAvailable: true,
				transcribe: vi.fn().mockResolvedValue('transcrição'),
			};

			const router = createSTTRouter([provider]);
			await router.transcribe('base64audio', { languageHint: 'pt', filename: 'audio.ogg' });

			expect(provider.transcribe).toHaveBeenCalledWith('base64audio', {
				languageHint: 'pt',
				filename: 'audio.ogg',
			});
		});
	});

	describe('getAvailableProviders', () => {
		it('returns only available providers', async () => {
			const { createSTTRouter } = await import('@/core/stt/stt-router');
			const provider1 = { name: 'cloudflare', isAvailable: true, transcribe: vi.fn() };
			const provider2 = { name: 'groq', isAvailable: false, transcribe: vi.fn() };

			const router = createSTTRouter([provider1, provider2]);
			expect(router.getAvailableProviders()).toEqual(['cloudflare']);
		});
	});
});
