import { Hono } from 'hono';
import { userService } from '@/services/user-service';
import { preferencesService } from '@/services/preferences-service';
import { accountLinkingService } from '@/services/account-linking-service';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { env } from '@/config/env';

export const userRoutes = new Hono()
	.get('/profile', zValidator('query', z.object({ userId: z.string() })), async (c) => {
		const { userId } = c.req.valid('query');
		const user = await userService.getUserById(userId);
		if (!user) return c.json({ error: 'User not found' }, 404);
		return c.json({ user });
	})
	.get('/accounts', zValidator('query', z.object({ userId: z.string() })), async (c) => {
		const { userId } = c.req.valid('query');
		const accounts = await userService.getUserAccounts(userId);
		return c.json({ accounts });
	})
	.post('/link/telegram', zValidator('json', z.object({ userId: z.string() })), async (c) => {
		const { userId } = c.req.valid('json');
		const token = await accountLinkingService.generateLinkingToken(userId, 'telegram');

		// Constrói URL de deep link
		// Nota: botUsername deve ser configurado ou buscado. Vou usar placeholder por enquanto.
		const botUsername = env.TELEGRAM_BOT_USERNAME || 'NexoAIBot';
		const link = `https://t.me/${botUsername}?start=${token}`;

		return c.json({ link, token });
	})
	.get('/link/discord', zValidator('query', z.object({ userId: z.string() })), async (c) => {
		const { userId } = c.req.valid('query');

		const clientId = env.DISCORD_CLIENT_ID;
		const redirectUri = encodeURIComponent(env.DISCORD_REDIRECT_URI || '');
		const scope = encodeURIComponent('identify');

		const link = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${userId}`;

		return c.json({ link });
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
