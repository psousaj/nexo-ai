import { analyticsService } from '@nexo/api-core/services/analytics-service';
import Elysia from 'elysia';
import { betterAuthPlugin } from '@/plugins/better-auth';

export const analyticsRoutes = new Elysia({ prefix: '/analytics' }).use(betterAuthPlugin).get(
	'/',
	async ({ user }) => {
		const isAdmin = (user as { role?: string }).role === 'admin';
		const scopedUserId = isAdmin ? undefined : user.id;

		const [kpis, trends, breakdown, recentItems] = await Promise.all([
			analyticsService.getKPIs(scopedUserId),
			analyticsService.getTrends(scopedUserId),
			analyticsService.getBreakdown(scopedUserId),
			analyticsService.getRecentItems(5, scopedUserId),
		]);

		return { kpis, trends, breakdown, recentItems };
	},
	{ auth: true },
);
