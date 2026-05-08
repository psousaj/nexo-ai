import type { Hono } from 'hono';
import { registerHealthRoutes } from './health';
import { registerMemoryRoutes } from './memories';
import { registerPreferencesRoutes } from './preferences';
import { registerAccountRoutes } from './accounts';
import { registerConversationRoutes } from './conversations';
import { registerWhatsAppSettingsRoutes } from './whatsapp-settings';
import { registerDiscordRoutes } from './discord';
import { registerTelegramWebhook } from './webhook/telegram';

export function registerRoutes(app: Hono) {
	registerHealthRoutes(app);
	registerMemoryRoutes(app);
	registerPreferencesRoutes(app);
	registerAccountRoutes(app);
	registerConversationRoutes(app);
	registerWhatsAppSettingsRoutes(app);
	registerDiscordRoutes(app);
	registerTelegramWebhook(app);
}
