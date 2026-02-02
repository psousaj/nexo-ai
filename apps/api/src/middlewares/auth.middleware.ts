import type { Context, Next } from 'hono';
import { authPlugin } from '@/lib/auth';

/**
 * Middleware para proteger rotas e injetar o usuário na Context
 */
export async function authMiddleware(c: Context, next: Next) {
	// Log headers para debug
	console.log('🔒 [authMiddleware] Headers recebidos:', Object.fromEntries(c.req.raw.headers.entries()));
	const session = await authPlugin.api.getSession({
		headers: c.req.raw.headers,
	});
	console.log('🔒 [authMiddleware] Sessão encontrada:', session);

	if (!session) {
		console.warn('🔒 [authMiddleware] Sessão NÃO encontrada!');
		return c.json({ error: 'Unauthorized' }, 401);
	}

	c.set('user', session.user);
	c.set('session', session.session);

	return next();
}
