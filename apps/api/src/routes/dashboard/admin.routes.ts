import { adminService } from '@/services/admin-service';
import { getWhatsAppSettings, setActiveWhatsAppApi, invalidateWhatsAppProviderCache } from '@/adapters/messaging';
import { Hono } from 'hono';

export const adminRoutes = new Hono()
	.get('/errors', async (c) => {
		const errors = await adminService.getErrorReports();
		return c.json(errors);
	})
	.get('/conversations', async (c) => {
		const conversations = await adminService.getConversationSummaries();
		return c.json(conversations);
	})
	// ========== WhatsApp Settings ==========
	.get('/whatsapp-settings', async (c) => {
		const settings = await getWhatsAppSettings();
		return c.json(settings);
	})
	.post('/whatsapp-settings/api', async (c) => {
		const { api } = await c.req.json();

		if (api !== 'meta' && api !== 'baileys') {
			return c.json({ error: 'API must be "meta" or "baileys"' }, 400);
		}

		await setActiveWhatsAppApi(api);

		// Invalidar cache para garantir que a nova API seja usada
		invalidateWhatsAppProviderCache();

		return c.json({ success: true, activeApi: api });
	})
	.post('/whatsapp-settings/cache/clear', async (c) => {
		invalidateWhatsAppProviderCache();
		return c.json({ success: true, message: 'Cache cleared' });
	});
