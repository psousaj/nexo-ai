import type { Hono } from 'hono';
import { registerAccountRoutes } from './accounts';
import { registerDiscordRoutes } from './discord';
import { registerHealthRoutes } from './health';
import { registerMemoryRoutes } from './memories';
import { registerPreferencesRoutes } from './preferences';
import { registerTelegramWebhook } from './webhook/telegram';
import { registerWhatsAppSettingsRoutes } from './whatsapp-settings';

export function registerRoutes(app: Hono) {
	registerHealthRoutes(app);
	registerMemoryRoutes(app);
	registerPreferencesRoutes(app);
	registerAccountRoutes(app);
	registerWhatsAppSettingsRoutes(app);
	registerDiscordRoutes(app);
	registerTelegramWebhook(app);
}
