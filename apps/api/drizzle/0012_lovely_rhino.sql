ALTER TABLE "messages" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "provider_message_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "provider_payload" jsonb;--> statement-breakpoint
CREATE INDEX "messages_provider_message_idx" ON "messages" USING btree ("provider","provider_message_id");