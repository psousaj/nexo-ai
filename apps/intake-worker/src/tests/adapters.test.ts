import { describe, expect, it } from 'vitest';
import { StubOcrAdapter } from '../adapters/ocr/ocr-adapter';
import { StubSttAdapter } from '../adapters/stt/stt-adapter';

describe('worker adapter stubs', () => {
	it('returns empty OCR extraction by default', async () => {
		const adapter = new StubOcrAdapter();
		const result = await adapter.extractText({
			kind: 'image',
			messageId: 'img-1',
			userId: 'usr-1',
			timestamp: new Date(),
			mimeType: 'image/png',
			transport: 'url',
			content: 'https://cdn.example/image.png',
		});

		expect(result.provider).toBe('stub-ocr');
		expect(result.text).toBe('');
	});

	it('returns empty STT transcription by default', async () => {
		const adapter = new StubSttAdapter();
		const result = await adapter.transcribe({
			kind: 'audio',
			messageId: 'aud-1',
			userId: 'usr-2',
			timestamp: new Date(),
			mimeType: 'audio/ogg',
			transport: 'url',
			content: 'https://cdn.example/audio.ogg',
		});

		expect(result.provider).toBe('stub-stt');
		expect(result.text).toBe('');
	});
});
