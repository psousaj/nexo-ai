CREATE TABLE "memory_envelopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"session_key" text NOT NULL,
	"source_kind" text NOT NULL,
	"source_channel" text,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"raw_artifact" jsonb NOT NULL,
	"normalized_content" text NOT NULL,
	"artifact_metadata" jsonb NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"relevance_decay" jsonb NOT NULL,
	"audit" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0,
	"config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "turn_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_type" text NOT NULL,
	"session_key" text,
	"context_hash" text,
	"policies" jsonb NOT NULL,
	"tools" jsonb NOT NULL,
	"failures" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memory_items" ADD COLUMN "source_envelope_id" uuid;--> statement-breakpoint
ALTER TABLE "memory_items" ADD COLUMN "last_accessed_at" timestamp;--> statement-breakpoint
ALTER TABLE "memory_insights" ADD COLUMN "source_envelope_id" uuid;--> statement-breakpoint
ALTER TABLE "memory_envelopes" ADD CONSTRAINT "memory_envelopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memory_envelopes_user_id_idx" ON "memory_envelopes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memory_envelopes_session_key_idx" ON "memory_envelopes" USING btree ("session_key");--> statement-breakpoint
CREATE INDEX "memory_envelopes_source_kind_idx" ON "memory_envelopes" USING btree ("source_kind");--> statement-breakpoint
CREATE INDEX "memory_envelopes_created_at_idx" ON "memory_envelopes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "turn_audits_run_type_idx" ON "turn_audits" USING btree ("run_type");--> statement-breakpoint
CREATE INDEX "turn_audits_session_key_idx" ON "turn_audits" USING btree ("session_key");