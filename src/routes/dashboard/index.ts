import { Hono } from 'hono';
import { analyticsRoutes } from './analytics.routes';
import { memoriesRoutes } from './memories.routes';
import { adminRoutes } from './admin.routes';
import { userRoutes } from './user.routes';

export const dashboardRouter = new Hono()
	.route('/analytics', analyticsRoutes)
	.route('/memories', memoriesRoutes)
	.route('/admin', adminRoutes)
	.route('/user', userRoutes);
