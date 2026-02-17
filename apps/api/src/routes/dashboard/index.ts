import { Hono } from 'hono';
import { adminRoutes } from './admin.routes';
import { analyticsRoutes } from './analytics.routes';
import { memoriesRoutes } from './memories.routes';
import { userRoutes } from './user.routes';

import { authMiddleware } from '@/middlewares/auth.middleware';

export const dashboardRouter = new Hono();

// Protege todas as rotas do dashboard
dashboardRouter.use('*', authMiddleware);

dashboardRouter
	.route('/analytics', analyticsRoutes)
	.route('/memories', memoriesRoutes)
	.route('/admin', adminRoutes)
	.route('/user', userRoutes);
