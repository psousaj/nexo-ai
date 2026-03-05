import { describe, expect, it, vi } from 'vitest';

vi.mock('@nexo/env', () => ({
	env: {
		MULTIMODAL_AUDIO: true,
		MULTIMODAL_IMAGE: false,
	},
}));

import { createIntakeWorkerApp } from '../app';

describe('intake worker healthcheck', () => {
	it('returns service health and multimodal feature flags', async () => {
		const app = createIntakeWorkerApp();
		const response = await app.request('http://localhost/health');
		const body = (await response.json()) as Record<string, any>;

		expect(response.status).toBe(200);
		expect(body.status).toBe('ok');
		expect(body.service).toBe('intake-worker');
		expect(body.features).toEqual({ audio: true, image: false });
	});
});
