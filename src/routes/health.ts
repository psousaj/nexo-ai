import { Hono } from 'hono';

export const healthRoutes = new Hono();

/**
 * GET /health - Health check
 */
healthRoutes.get('/health', (c) => {
	return c.json({
		status: 'ok',
		timestamp: new Date().toISOString(),
	});
});
