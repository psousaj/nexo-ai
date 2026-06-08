import type { MultimodalIntakePayload } from '@nexo/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnv = {
	PORT: 3001,
};

vi.mock('@/config/env', () => ({
	env: mockEnv,
}));

describe('IntakeWorkerClient', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('posts attachments to internal intake endpoint', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ items: [{ kind: 'image', messageId: 'msg-1', text: 'screenshot text' }] }),
		});
		vi.stubGlobal('fetch', fetchMock);

		const { IntakeWorkerClient } = await import('@/services/intake-worker-client');
		const client = new IntakeWorkerClient();

		const attachments: MultimodalIntakePayload[] = [
			{
				kind: 'image',
				messageId: 'msg-1',
				userId: 'user-1',
				mimeType: 'image/png',
				url: 'https://cdn.example/image.png',
			},
		];

		const result = await client.processAttachments(attachments);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			'http://localhost:3001/internal/intake/process',
			expect.objectContaining({ method: 'POST' }),
		);
		expect(result.items).toHaveLength(1);
		expect(result.items[0].text).toBe('screenshot text');
	});

	it('throws deterministic error on non-2xx response', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
		vi.stubGlobal('fetch', fetchMock);

		const { IntakeWorkerClient } = await import('@/services/intake-worker-client');
		const client = new IntakeWorkerClient();

		await expect(
			client.processAttachments([
				{
					kind: 'image',
					messageId: 'msg-3',
					userId: 'user-3',
					mimeType: 'image/jpeg',
					url: 'https://cdn.example/image.jpg',
				},
			]),
		).rejects.toThrow('internal intake request failed (503)');
	});
});
