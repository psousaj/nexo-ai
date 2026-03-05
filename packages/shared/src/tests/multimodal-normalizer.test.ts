import { describe, expect, it } from 'vitest';
import { normalizeMultimodalPayload } from '../utils/multimodal-normalizer';

const enabledFlags = {
	MULTIMODAL_AUDIO: true,
	MULTIMODAL_IMAGE: true,
};

describe('normalizeMultimodalPayload', () => {
	it('normalizes audio payload with url transport', () => {
		const normalized = normalizeMultimodalPayload(
			{
				kind: 'audio',
				messageId: 'msg-1',
				userId: 'user-1',
				mimeType: 'audio/ogg',
				url: 'https://cdn.example/audio.ogg',
				languageHint: 'pt-BR',
			},
			enabledFlags,
		);

		expect(normalized.kind).toBe('audio');
		expect(normalized.transport).toBe('url');
		expect(normalized.content).toBe('https://cdn.example/audio.ogg');
	});

	it('normalizes image payload with base64 transport', () => {
		const normalized = normalizeMultimodalPayload(
			{
				kind: 'image',
				messageId: 'msg-2',
				userId: 'user-2',
				mimeType: 'image/png',
				base64: 'base64-content',
			},
			enabledFlags,
		);

		expect(normalized.kind).toBe('image');
		expect(normalized.transport).toBe('base64');
		expect(normalized.content).toBe('base64-content');
	});

	it('throws when modality is disabled by feature flag', () => {
		expect(() =>
			normalizeMultimodalPayload(
				{
					kind: 'audio',
					messageId: 'msg-3',
					userId: 'user-3',
					mimeType: 'audio/mpeg',
					url: 'https://cdn.example/audio.mp3',
				},
				{ MULTIMODAL_AUDIO: false, MULTIMODAL_IMAGE: true },
			),
		).toThrow('MULTIMODAL_AUDIO feature flag is disabled');
	});
});
