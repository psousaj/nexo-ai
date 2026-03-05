import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
	vi.resetModules();
});

describe('intake worker app routes', () => {
	it('returns service health and multimodal feature flags', async () => {
		vi.doMock('../config/env', () => ({
			getWorkerEnv: () => ({
				PORT: 3002,
				INTAKE_WORKER_TOKEN: '',
				MULTIMODAL_AUDIO: true,
				MULTIMODAL_IMAGE: false,
			}),
		}));

		const { createIntakeWorkerApp } = await import('../app');
		const app = createIntakeWorkerApp();
		const response = await app.request('http://localhost/health');
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(body.status).toBe('ok');
		expect(body.service).toBe('intake-worker');
		expect(body.features).toEqual({ audio: true, image: false });
	});

	it('rejects unauthorized requests when worker token is configured', async () => {
		vi.doMock('../config/env', () => ({
			getWorkerEnv: () => ({
				PORT: 3002,
				INTAKE_WORKER_TOKEN: 'worker-token',
				MULTIMODAL_AUDIO: true,
				MULTIMODAL_IMAGE: true,
			}),
		}));

		const { createIntakeWorkerApp } = await import('../app');
		const app = createIntakeWorkerApp();

		const response = await app.request('http://localhost/intake/process', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				attachments: [
					{
						kind: 'audio',
						messageId: 'msg-audio',
						userId: 'user-1',
						mimeType: 'audio/ogg',
						url: 'https://cdn.example/audio.ogg',
					},
					{
						kind: 'image',
						messageId: 'msg-image',
						userId: 'user-1',
						mimeType: 'image/png',
						url: 'https://cdn.example/image.png',
					},
				],
			}),
		});

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: 'unauthorized',
			message: 'Missing or invalid bearer token',
		});
	});

	it('rejects requests with an invalid bearer token when worker token is configured', async () => {
		vi.doMock('../config/env', () => ({
			getWorkerEnv: () => ({
				PORT: 3002,
				INTAKE_WORKER_TOKEN: 'worker-token',
				MULTIMODAL_AUDIO: true,
				MULTIMODAL_IMAGE: true,
			}),
		}));

		const { createIntakeWorkerApp } = await import('../app');
		const app = createIntakeWorkerApp();

		const response = await app.request('http://localhost/intake/process', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: 'Bearer wrong-token',
			},
			body: JSON.stringify({ attachments: [] }),
		});

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: 'unauthorized',
			message: 'Missing or invalid bearer token',
		});
	});

	it('rejects malformed authorization schemes when worker token is configured', async () => {
		vi.doMock('../config/env', () => ({
			getWorkerEnv: () => ({
				PORT: 3002,
				INTAKE_WORKER_TOKEN: 'worker-token',
				MULTIMODAL_AUDIO: true,
				MULTIMODAL_IMAGE: true,
			}),
		}));

		const { createIntakeWorkerApp } = await import('../app');
		const app = createIntakeWorkerApp();

		const response = await app.request('http://localhost/intake/process', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: 'Basic worker-token',
			},
			body: JSON.stringify({ attachments: [] }),
		});

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: 'unauthorized',
			message: 'Missing or invalid bearer token',
		});
	});

	it('accepts authorized requests when worker token is configured', async () => {
		vi.doMock('../config/env', () => ({
			getWorkerEnv: () => ({
				PORT: 3002,
				INTAKE_WORKER_TOKEN: 'worker-token',
				MULTIMODAL_AUDIO: true,
				MULTIMODAL_IMAGE: true,
			}),
		}));

		const { createIntakeWorkerApp } = await import('../app');
		const app = createIntakeWorkerApp();

		const response = await app.request('http://localhost/intake/process', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: 'Bearer worker-token',
			},
			body: JSON.stringify({
				attachments: [
					{
						kind: 'audio',
						messageId: 'msg-audio',
						userId: 'user-1',
						mimeType: 'audio/ogg',
						url: 'https://cdn.example/audio.ogg',
					},
					{
						kind: 'image',
						messageId: 'msg-image',
						userId: 'user-1',
						mimeType: 'image/png',
						url: 'https://cdn.example/image.png',
					},
				],
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			items: [
				{
					kind: 'audio',
					messageId: 'msg-audio',
					text: '',
					metadata: {
						provider: 'stub-stt',
						transport: 'url',
						mimeType: 'audio/ogg',
					},
				},
				{
					kind: 'image',
					messageId: 'msg-image',
					text: '',
					metadata: {
						provider: 'stub-ocr',
						transport: 'url',
						mimeType: 'image/png',
					},
				},
			],
		});
	});

	it('still processes requests without auth token when token is not configured', async () => {
		vi.doMock('../config/env', () => ({
			getWorkerEnv: () => ({
				PORT: 3002,
				INTAKE_WORKER_TOKEN: '',
				MULTIMODAL_AUDIO: true,
				MULTIMODAL_IMAGE: true,
			}),
		}));

		const { createIntakeWorkerApp } = await import('../app');
		const app = createIntakeWorkerApp();

		const response = await app.request('http://localhost/intake/process', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				attachments: [
					{
						kind: 'image',
						messageId: 'msg-image',
						userId: 'user-1',
						mimeType: 'image/png',
						url: 'https://cdn.example/image.png',
					},
				],
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			items: [
				{
					kind: 'image',
					messageId: 'msg-image',
					text: '',
					metadata: {
						provider: 'stub-ocr',
						transport: 'url',
						mimeType: 'image/png',
					},
				},
			],
		});
	});

	it('returns 400 when request body does not contain attachments array', async () => {
		vi.doMock('../config/env', () => ({
			getWorkerEnv: () => ({
				PORT: 3002,
				INTAKE_WORKER_TOKEN: '',
				MULTIMODAL_AUDIO: true,
				MULTIMODAL_IMAGE: true,
			}),
		}));

		const { createIntakeWorkerApp } = await import('../app');
		const app = createIntakeWorkerApp();

		const response = await app.request('http://localhost/intake/process', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ payload: [] }),
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'invalid_request',
			message: 'Request body must include an attachments array',
		});
	});
});
