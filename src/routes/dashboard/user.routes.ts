import { Hono } from 'hono';
import { userService } from '@/services/user-service';
import { preferencesService } from '@/services/preferences-service';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const userRoutes = new Hono()
	.get('/profile', zValidator('query', z.object({ userId: z.string() })), async (c) => {
		const { userId } = c.req.valid('query');
		const user = await userService.getUserById(userId);
		if (!user) return c.json({ error: 'User not found' }, 404);
		return c.json({ user });
	})
	.get('/preferences', zValidator('query', z.object({ userId: z.string() })), async (c) => {
		const { userId } = c.req.valid('query');
		const preferences = await preferencesService.getPreferences(userId);
		return c.json(preferences);
	})
	.patch(
		'/preferences',
		zValidator(
			'json',
			z.object({
				userId: z.string(),
				assistantName: z.string().optional(),
				notificationsBrowser: z.boolean().optional(),
				notificationsWhatsapp: z.boolean().optional(),
				notificationsEmail: z.boolean().optional(),
				privacyShowMemoriesInSearch: z.boolean().optional(),
				privacyShareAnalytics: z.boolean().optional(),
				appearanceTheme: z.string().optional(),
				appearanceLanguage: z.string().optional(),
			}),
		),
		async (c) => {
			const { userId, ...updates } = c.req.valid('json');
			await preferencesService.updatePreferences(userId, updates);
			return c.json({ success: true });
		},
	);
