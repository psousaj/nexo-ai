import { Hono } from 'hono';
import { auth } from '@/lib/auth';

export const authRouter = new Hono().on(['POST', 'GET'], '/*', async (c) => {
	try {
		// Better Auth precisa retornar uma Response válida
		const response = await auth.handler(c.req.raw);
		return response;
	} catch (error) {
		console.error('❌ Better Auth error:', error);
		return c.json({ error: 'Authentication error' }, 500);
	}
});
