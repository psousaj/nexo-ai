import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * WhatsApp Settings
 *
 * Global settings for WhatsApp integration.
 * Controls which API provider to use (Meta or Baileys).
 */
export const whatsappSettings = pgTable('whatsapp_settings', {
	id: text('id').primaryKey().default('global'),
	/**
	 * activeApi - Which WhatsApp API to use
	 * 'meta' - Official Meta WhatsApp Business API (cloud-hosted)
	 * 'baileys' - Unofficial Baileys API (self-hosted WebSocket, OpenClaw-style)
	 */
	activeApi: text('active_api').$type<'meta' | 'baileys'>().notNull().default('meta'),
	/**
	 * baileysPhoneNumber - Phone number connected to Baileys
	 * Stored when Baileys is successfully paired
	 */
	baileysPhoneNumber: text('baileys_phone_number'),
	/**
	 * metaPhoneNumberId - Phone Number ID from Meta API
	 * Retrieved from Meta WhatsApp Business API configuration
	 */
	metaPhoneNumberId: text('meta_phone_number_id'),
	/**
	 * baileysConnectionStatus - Current Baileys connection status
	 * 'connecting', 'connected', 'disconnected', 'error'
	 */
	baileysConnectionStatus: text('baileys_connection_status').$type<
		'connecting' | 'connected' | 'disconnected' | 'error'
	>(),
	/**
	 * lastError - Last error message (if any)
	 */
	lastError: text('last_error'),
	/**
	 * updatedAt - Last time settings were changed
	 */
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
	/**
	 * createdAt - When settings were first created
	 */
	createdAt: timestamp('created_at').defaultNow().notNull(),
});
