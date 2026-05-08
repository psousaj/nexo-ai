import type { Hono } from 'hono';
import pkg from '../../package.json';

export function registerHealthRoutes(app: Hono) {
	app.get('/health', (c) => c.json({ status: 'ok' }));
	app.get('/', (c) =>
		c.json({ name: 'Nexo AI Hermes', version: pkg.version, description: 'Hermes Engine - Nexo AI assistive core' }),
	);
}
