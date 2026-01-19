import { Hono } from 'hono';

export const healthRouter = new Hono()
	/**
	 * GET /health - Health check
	 */
	.get('/', (c) => {
		return c.json({
			status: 'ok',
			timestamp: new Date().toISOString(),
		});
	});
