import { authPlugin } from '@nexo/api-core/lib/auth';
import { userService } from '@nexo/api-core/services/user-service';
import Elysia from 'elysia';

/**
 * Better Auth Elysia plugin.
 *
 * - Mounts Better Auth handler at /api/auth (via .mount())
 * - Exposes `auth` macro: resolves session + user from request headers
 * - Exposes `adminAuth` macro: additionally validates admin role
 *
 * Usage in routes:
 *   .get('/me', ({ user }) => user, { auth: true })
 *   .get('/admin', ({ user }) => user, { adminAuth: true })
 */
export const betterAuthPlugin = new Elysia({ name: 'better-auth' }).mount('/api/auth', authPlugin.handler).macro({
	/**
	 * Auth guard: resolves user + session from Better Auth session cookie.
	 * Returns 401 if no valid session found.
	 */
	auth: {
		async resolve({ status, request: { headers } }) {
			const session = await authPlugin.api.getSession({ headers });

			if (!session) return status(401);

			// Verify user still exists in DB (stale cookie cache prevention)
			const user = await userService.getUserById(session.user.id);
			if (!user) return status(401);

			return {
				user: session.user,
				session: session.session,
			};
		},
	},

	/**
	 * Admin guard: same as auth but additionally enforces role=admin.
	 * Returns 403 if user is not an admin.
	 */
	adminAuth: {
		async resolve({ status, request: { headers } }) {
			const session = await authPlugin.api.getSession({ headers });

			if (!session) return status(401);

			const user = await userService.getUserById(session.user.id);
			if (!user) return status(401);

			if ((session.user as { role?: string }).role !== 'admin') return status(403);

			return {
				user: session.user,
				session: session.session,
			};
		},
	},
});
