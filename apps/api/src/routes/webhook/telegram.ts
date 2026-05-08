import type { Hono } from 'hono';

export function registerTelegramWebhook(app: Hono) {
	app.post('/webhook/telegram', async (c) => {
		try {
			await c.req.json();
			return c.json({ ok: true });
		} catch {
			return c.json({ ok: false, error: 'Invalid update' }, 400);
		}
	});
}
