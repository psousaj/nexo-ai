import type { MultimodalIntakePayload } from '@nexo/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnv = {
	INTAKE_WORKER_URL: 'http://localhost:3002',
	INTAKE_WORKER_TIMEOUT_MS: 2000,
	INTAKE_WORKER_TOKEN: undefined as string | undefined,
};

vi.mock('@/config/env', () => ({
	env: mockEnv,
}));

describe('IntakeWorkerClient', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		mockEnv.INTAKE_WORKER_TOKEN = undefined;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('posts attachments to intake worker endpoint', async () => {
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
			'http://localhost:3002/intake/process',
			expect.objectContaining({ method: 'POST' }),
		);
		expect(result.items).toHaveLength(1);
		expect(result.items[0].text).toBe('screenshot text');
	});

	it('sends bearer token when configured', async () => {
		mockEnv.INTAKE_WORKER_TOKEN = 'worker-token';
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ items: [] }),
		});
		vi.stubGlobal('fetch', fetchMock);

		const { IntakeWorkerClient } = await import('@/services/intake-worker-client');
		const client = new IntakeWorkerClient();

		await client.processAttachments([
			{
				kind: 'audio',
				messageId: 'msg-2',
				userId: 'user-2',
				mimeType: 'audio/ogg',
				url: 'https://cdn.example/audio.ogg',
			},
		]);

		const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
		expect(options.headers).toEqual(
			expect.objectContaining({
				authorization: 'Bearer worker-token',
			}),
		);
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
		).rejects.toThrow('intake-worker request failed (503)');
	});
});
