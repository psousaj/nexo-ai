import type { Context, Next } from 'hono';

/**
 * Middleware para proteger rotas exclusivas de admin.
 *
 * Deve ser aplicado APÓS o authMiddleware (que injeta `c.get('user')`).
 * Garante que apenas usuários com role='admin' acessem a rota.
 */
export async function adminMiddleware(c: Context, next: Next) {
	const user = c.get('user') as { role?: string } | undefined;

	if (!user || user.role !== 'admin') {
		return c.json({ error: 'Forbidden' }, 403);
	}

	return next();
}
