import { Hono } from 'hono';
import { userService } from '@/services/user-service';
import { preferencesService } from '@/services/preferences-service';
import { accountLinkingService } from '@/services/account-linking-service';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { env } from '@/config/env';

export const userRoutes = new Hono<{ Variables: { user: any; session: any } }>()
	.get('/profile', async (c) => {
		const userState = c.get('user');
		const user = await userService.getUserById(userState.id);
		if (!user) return c.json({ error: 'User not found' }, 404);
		return c.json({ user });
	})
	.get('/accounts', async (c) => {
		const userState = c.get('user');
		const accounts = await userService.getUserAccounts(userState.id);
		return c.json({ accounts });
	})
	.post('/link/telegram', async (c) => {
		const userState = c.get('user');
		const token = await accountLinkingService.generateLinkingToken(userState.id, 'telegram', 'link');

		const botUsername = env.TELEGRAM_BOT_USERNAME || 'NexoAIBot';
		const link = `https://t.me/${botUsername}?start=${token}`;

		return c.json({ link, token });
	})
	.get('/link/discord', async (c) => {
		const userState = c.get('user');

		const clientId = env.DISCORD_CLIENT_ID;
		const redirectUri = encodeURIComponent(env.DISCORD_REDIRECT_URI || '');
		const scope = encodeURIComponent('identify');

		const link = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${userState.id}`;

		return c.json({ link });
	})
	.post('/link/consume', zValidator('json', z.object({ token: z.string() })), async (c) => {
		const userState = c.get('user');
		const { token } = c.req.valid('json');

		const linked = await accountLinkingService.linkTokenAccountToUser(token, userState.id);
		if (!linked) return c.json({ error: 'Invalid or expired token' }, 400);

		return c.json({ success: true });
	})
	.get('/preferences', async (c) => {
		const userState = c.get('user');
		const preferences = await preferencesService.getPreferences(userState.id);
		return c.json(preferences);
	})
	.patch(
		'/preferences',
		zValidator(
			'json',
			z.object({
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
			const userState = c.get('user');
			const updates = c.req.valid('json');
			await preferencesService.updatePreferences(userState.id, updates);
			return c.json({ success: true });
		},
	);
