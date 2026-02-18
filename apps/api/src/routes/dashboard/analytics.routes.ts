import { analyticsService } from '@/services/analytics-service';
import { Hono } from 'hono';

export const analyticsRoutes = new Hono().get('/', async (c) => {
	const kpis = await analyticsService.getKPIs();
	const trends = await analyticsService.getTrends();
	const breakdown = await analyticsService.getBreakdown();
	const recentItems = await analyticsService.getRecentItems();

	return c.json({
		kpis,
		trends,
		breakdown,
		recentItems,
	});
});
