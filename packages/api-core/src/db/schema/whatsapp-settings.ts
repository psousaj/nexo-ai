import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * WhatsApp Settings
 *
 * Global settings for WhatsApp integration.
 * Mantém metadados operacionais do provider Evolution.
 */
export const whatsappSettings = pgTable("whatsapp_settings", {
  id: text("id").primaryKey().default("global"),
  /**
   * Campo legado para compatibilidade com dashboard antigo.
   * Na arquitetura atual, sempre deve permanecer como 'evolution'.
   */
  activeApi: text("active_api")
    .$type<"evolution">()
    .notNull()
    .default("evolution"),
  /**
   * phoneNumber - Phone number connected to instance
   */
  phoneNumber: text("phone_number"),
  /**
   * metaPhoneNumberId - Phone Number ID from Meta API
   * Retrieved from Meta WhatsApp Business API configuration
   */
  metaPhoneNumberId: text("meta_phone_number_id"),
  /**
   * connectionStatus - Current WhatsApp connection status
   * 'connecting', 'connected', 'disconnected', 'error'
   */
  connectionStatus: text("connection_status").$type<
    "connecting" | "connected" | "disconnected" | "error"
  >(),
  /**
   * lastError - Last error message (if any)
   */
  lastError: text("last_error"),
  /**
   * updatedAt - Last time settings were changed
   */
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  /**
   * createdAt - When settings were first created
   */
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
