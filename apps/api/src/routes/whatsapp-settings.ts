import type { Hono } from 'hono';

export function registerWhatsAppSettingsRoutes(app: Hono) {
	app.get('/admin/whatsapp-settings', (c) => c.json({}));
	app.post('/admin/whatsapp-settings/cache/clear', (c) => c.json({ success: true, message: 'Cache cleared' }));
	app.get('/admin/whatsapp-settings/qr-code', (c) => c.json({ qrCode: null, connectionStatus: 'disconnected' }));
	app.post('/admin/whatsapp-settings/evolution/connect', (c) => c.json({ success: false, error: 'Evolution API not configured' }));
	app.post('/admin/whatsapp-settings/evolution/disconnect', (c) => c.json({ success: true }));
	app.post('/admin/whatsapp-settings/evolution/restart', (c) => c.json({ success: true }));
}
