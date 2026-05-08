import type { Hono } from 'hono';

export function registerWhatsAppWebhook(app: Hono) {
	app.post('/webhook/whatsapp/evolution', (c) => c.json({ ok: true }));
}
