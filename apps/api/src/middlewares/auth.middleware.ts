import { authPlugin } from '@/lib/auth';
import { userService } from '@/services/user-service';
import type { Context, Next } from 'hono';

/**
 * Middleware para proteger rotas e injetar o usuário na Context
 *
 * NOTA: Better Auth tem cookieCache ativo (sessões armazenadas no cookie sem hit no DB).
 * Isso pode retornar sessões stale quando o banco é resetado mas o cookie ainda está válido.
 * A verificação de existência do user no DB aqui previne FK violations nas rotas.
 */
export async function authMiddleware(c: Context, next: Next) {
	const session = await authPlugin.api.getSession({
		headers: c.req.raw.headers,
	});

	if (!session) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	// Verifica se o usuário ainda existe no banco (cookie cache pode estar stale)
	const user = await userService.getUserById(session.user.id);
	if (!user) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	c.set('user', session.user);
	c.set('session', session.session);

	return next();
}
