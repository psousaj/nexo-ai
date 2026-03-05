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

	it('assigns default timestamp when payload omits one', () => {
		const defaultTimestamp = new Date('2026-01-10T10:00:00.000Z');
		const normalized = normalizeMultimodalPayload(
			{
				kind: 'image',
				messageId: 'msg-6',
				userId: 'user-6',
				mimeType: 'image/jpeg',
				url: 'https://cdn.example/image.jpeg',
			},
			enabledFlags,
			defaultTimestamp,
		);

		expect(normalized.timestamp).toEqual(defaultTimestamp);
	});

	it('throws when both url and base64 are provided', () => {
		expect(() =>
			normalizeMultimodalPayload(
				{
					kind: 'audio',
					messageId: 'msg-4',
					userId: 'user-4',
					mimeType: 'audio/mpeg',
					url: 'https://cdn.example/audio.mp3',
					base64: 'base64-content',
				},
				enabledFlags,
			),
		).toThrow('payload must include exactly one transport: url or base64');
	});

	it('throws when neither url nor base64 is provided', () => {
		expect(() =>
			normalizeMultimodalPayload(
				{
					kind: 'image',
					messageId: 'msg-5',
					userId: 'user-5',
					mimeType: 'image/png',
				},
				enabledFlags,
			),
		).toThrow('payload must include exactly one transport: url or base64');
	});

	it('throws when audio modality is disabled by feature flag', () => {
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

	it('throws when image modality is disabled by feature flag', () => {
		expect(() =>
			normalizeMultimodalPayload(
				{
					kind: 'image',
					messageId: 'msg-7',
					userId: 'user-7',
					mimeType: 'image/png',
					url: 'https://cdn.example/image.png',
				},
				{ MULTIMODAL_AUDIO: true, MULTIMODAL_IMAGE: false },
			),
		).toThrow('MULTIMODAL_IMAGE feature flag is disabled');
	});
});
