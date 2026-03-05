import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
	vi.resetModules();
});

describe('intake worker healthcheck', () => {
	it('returns service health and multimodal feature flags', async () => {
		vi.doMock('../config/env', () => ({
			getWorkerEnv: () => ({
				PORT: 3001,
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
});
