CREATE TYPE "public"."messaging_channel" AS ENUM('whatsapp', 'telegram', 'discord');
--> statement-breakpoint
CREATE TABLE "user_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"channel" "public"."messaging_channel" NOT NULL,
	"channel_user_id" varchar(255) NOT NULL,
	"channel_email" varchar(255),
	"linked_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_channels_channel_identity_unique" UNIQUE("channel","channel_user_id"),
	CONSTRAINT "user_channels_user_channel_unique" UNIQUE("user_id","channel")
);
--> statement-breakpoint
ALTER TABLE "user_channels" ADD CONSTRAINT "user_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_channels_channel_lookup_idx" ON "user_channels" USING btree ("channel","channel_user_id");
--> statement-breakpoint
CREATE INDEX "user_channels_user_lookup_idx" ON "user_channels" USING btree ("user_id");
--> statement-breakpoint
INSERT INTO "user_channels" ("user_id", "channel", "channel_user_id", "channel_email", "linked_at", "is_active", "metadata", "created_at", "updated_at")
SELECT user_id, provider::text::"public"."messaging_channel", provider_user_id, provider_email, linked_at, is_active, metadata, created_at, updated_at
FROM "auth_providers"
WHERE provider IN ('whatsapp', 'telegram', 'discord')
ON CONFLICT ON CONSTRAINT "user_channels_user_channel_unique" DO NOTHING;
--> statement-breakpoint
DROP TABLE "auth_providers" CASCADE;
--> statement-breakpoint
DROP TYPE "public"."auth_provider";
