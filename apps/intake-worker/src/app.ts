import { Hono } from 'hono';
import { getWorkerFeatureFlags } from './config/feature-flags';

export function createIntakeWorkerApp() {
	const app = new Hono();

	app.get('/health', (c) => {
		const flags = getWorkerFeatureFlags();
		return c.json({
			status: 'ok',
			service: 'intake-worker',
			timestamp: new Date().toISOString(),
			features: {
				audio: flags.MULTIMODAL_AUDIO,
				image: flags.MULTIMODAL_IMAGE,
			},
		});
	});

	return app;
}
