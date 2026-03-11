import Elysia from 'elysia';

export const healthRouter = new Elysia({ prefix: '/health' }).get('/', () => ({
	status: 'ok',
	timestamp: new Date().toISOString(),
}));
