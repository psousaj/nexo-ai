ALTER TABLE "whatsapp_settings" RENAME COLUMN "baileys_connection_status" TO "connection_status";--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ALTER COLUMN "active_api" SET DEFAULT 'evolution';--> statement-breakpoint
ALTER TABLE "whatsapp_settings" RENAME COLUMN "baileys_phone_number" TO "phone_number";