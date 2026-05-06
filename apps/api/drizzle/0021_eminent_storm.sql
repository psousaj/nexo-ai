CREATE TYPE "public"."daily_log_category" AS ENUM('conversation', 'task', 'event', 'error');--> statement-breakpoint
CREATE TABLE "memory_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_item_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"version" integer NOT NULL,
	"type" text NOT NULL,
	"title" text,
	"metadata" jsonb,
	"content" text,
	"confidence" real DEFAULT 1 NOT NULL,
	"importance" real DEFAULT 0.5 NOT NULL,
	"source" text DEFAULT 'user' NOT NULL,
	"cognitive_type" text,
	"change_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "auto_tts" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "agent_daily_logs" ADD COLUMN "category" "daily_log_category" DEFAULT 'conversation' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_daily_logs" ADD COLUMN "embedding" vector(384);--> statement-breakpoint
ALTER TABLE "memory_versions" ADD CONSTRAINT "memory_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memory_versions_memory_item_id_idx" ON "memory_versions" USING btree ("memory_item_id");--> statement-breakpoint
CREATE INDEX "memory_versions_user_id_idx" ON "memory_versions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memory_versions_version_idx" ON "memory_versions" USING btree ("memory_item_id","version");--> statement-breakpoint
CREATE INDEX "agent_daily_logs_user_date_category_idx" ON "agent_daily_logs" USING btree ("user_id","log_date","category");