import Elysia from 'elysia';
import { adminRoutes } from './admin';
import { analyticsRoutes } from './analytics';
import { memoriesRoutes } from './memories';
import { toolsRoutes } from './tools';
import { userRoutes } from './user';

/**
 * Dashboard router — prefixed at /api in server.ts.
 *
 * All sub-routers enforce their own auth guards via betterAuthPlugin macros:
 * - `auth: true`  → any authenticated user
 * - `adminAuth: true` → admin only
 */
export const dashboardRouter = new Elysia({ prefix: '/api' })
	.use(analyticsRoutes)
	.use(memoriesRoutes)
	.use(adminRoutes)
	.use(toolsRoutes)
	.use(userRoutes);
