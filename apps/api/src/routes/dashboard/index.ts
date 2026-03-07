import { Hono } from 'hono';
import { adminRoutes } from './admin.routes';
import { analyticsRoutes } from './analytics.routes';
import { memoriesRoutes } from './memories.routes';
import toolsRoutes from './tools.routes';
import { userRoutes } from './user.routes';

import { adminMiddleware } from '@/middlewares/admin.middleware';
import { authMiddleware } from '@/middlewares/auth.middleware';

export const dashboardRouter = new Hono();

// Protege todas as rotas do dashboard com autenticação
dashboardRouter.use('*', authMiddleware);

// Protege todas as rotas /admin com verificação de role admin
dashboardRouter.use('/admin/*', adminMiddleware);

dashboardRouter
	.route('/analytics', analyticsRoutes)
	.route('/memories', memoriesRoutes)
	.route('/admin', adminRoutes)
	.route('/admin/tools', toolsRoutes)
	.route('/user', userRoutes);
