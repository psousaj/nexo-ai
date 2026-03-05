import { mapDiscordAttachmentsToMetadata } from '@/adapters/messaging/multimodal-attachments';
import { describe, expect, it } from 'vitest';

describe('mapDiscordAttachmentsToMetadata', () => {
	it('maps image and audio attachments into multimodal metadata payloads', () => {
		const mapped = mapDiscordAttachmentsToMetadata({
			attachments: [
				{
					url: 'https://cdn.example/image.png',
					contentType: 'image/png',
					name: 'image.png',
					size: 1024,
				},
				{
					url: 'https://cdn.example/audio.ogg',
					contentType: 'audio/ogg',
					name: 'audio.ogg',
					size: 2048,
				},
			],
			messageId: 'msg-1',
			userId: 'user-1',
			timestamp: new Date('2025-01-01T00:00:00.000Z'),
		});

		expect(mapped).toHaveLength(2);
		expect(mapped[0]).toMatchObject({ kind: 'image', mimeType: 'image/png', url: 'https://cdn.example/image.png' });
		expect(mapped[1]).toMatchObject({ kind: 'audio', mimeType: 'audio/ogg', url: 'https://cdn.example/audio.ogg' });
	});

	it('keeps backward compatibility by ignoring unsupported files', () => {
		const mapped = mapDiscordAttachmentsToMetadata({
			attachments: [
				{
					url: 'https://cdn.example/file.pdf',
					contentType: 'application/pdf',
					name: 'file.pdf',
					size: 512,
				},
			],
			messageId: 'msg-2',
			userId: 'user-2',
			timestamp: new Date('2025-01-01T00:00:00.000Z'),
		});

		expect(mapped).toEqual([]);
	});
});
