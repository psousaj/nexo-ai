import { db } from '@/db';
import { integrations } from '@/db/schema/integrations';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';

export function registerAccountRoutes(app: Hono) {
	app.get('/user/accounts', async (c) => {
		const accounts = await db
			.select()
			.from(integrations)
			.where(eq(integrations.userId, c.req.query('userId') ?? 'default'));
		return c.json({ accounts });
	});

	app.post('/user/accounts/sync', (c) =>
		c.json({ success: true, message: 'Sync not implemented', synced: 0, skipped: 0 }),
	);
	app.post('/user/link/telegram', (c) => {
		const code = Math.random().toString(36).substring(2, 8).toUpperCase();
		return c.json({ link: `https://t.me/nexo_bot?start=${code}`, vinculateCode: code });
	});
	app.get('/user/link/discord', (c) => c.json({ link: process.env.DISCORD_INVITE_URL ?? '#' }));
	app.post('/user/link/discord-bot', (c) => c.json({ token: 'not-configured', botUsername: 'nexo#0000' }));
	app.get('/user/link/google', (c) => c.json({ link: '#' }));
	app.post('/user/link/consume', (c) => c.json({ success: true }));
	app.delete('/user/accounts/:provider', async (c) => {
		await db.delete(integrations).where(eq(integrations.provider, c.req.param('provider')));
		return c.json({ success: true });
	});
}
