import type { Hono } from 'hono';

export function registerDiscordRoutes(app: Hono) {
	app.get('/user/discord-bot-info', (c) =>
		c.json({
			clientId: process.env.DISCORD_CLIENT_ID ?? '',
			botTokenConfigured: false,
			installUrl: null,
			permissions: '0',
			scopes: [],
			botUsername: 'nexo',
		}),
	);
	app.get('/user/discord-bot/status', (c) => c.json({ linked: false, reason: 'no_oauth' }));
}
