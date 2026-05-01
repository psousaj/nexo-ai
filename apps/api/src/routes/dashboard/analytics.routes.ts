import { analyticsService } from '@/services/analytics-service';
import { Hono } from 'hono';

export const analyticsRoutes = new Hono().get('/', async (c) => {
	const user = c.get('user') as { id: string; role?: string };
	const isAdmin = user?.role === 'admin';
	// Não-admin recebe apenas os próprios dados
	const scopedUserId = isAdmin ? undefined : user.id;

	const kpis = await analyticsService.getKPIs(scopedUserId);
	const trends = await analyticsService.getTrends(scopedUserId);
	const breakdown = await analyticsService.getBreakdown(scopedUserId);
	const recentItems = await analyticsService.getRecentItems(5, scopedUserId);

	return c.json({
		kpis,
		trends,
		breakdown,
		recentItems,
	});
});
