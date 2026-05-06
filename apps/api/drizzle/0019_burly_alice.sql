CREATE TYPE "public"."cognitive_type" AS ENUM('event', 'fact', 'preference', 'pattern', 'insight', 'note');--> statement-breakpoint
CREATE TYPE "public"."insight_type" AS ENUM('pattern', 'preference', 'fact_inferred', 'behavior');--> statement-breakpoint
CREATE TABLE "memory_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"insight_type" "insight_type" NOT NULL,
	"content" text NOT NULL,
	"summary" text,
	"confidence" real NOT NULL,
	"importance" real DEFAULT 0.5 NOT NULL,
	"derived_from" text[],
	"source" text DEFAULT 'inference' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"superseded_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "memory_items" ADD COLUMN "cognitive_type" "cognitive_type" DEFAULT 'note' NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_items" ADD COLUMN "confidence" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_items" ADD COLUMN "importance" real DEFAULT 0.5 NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_items" ADD COLUMN "source" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_items" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_insights" ADD CONSTRAINT "memory_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memory_insights_user_id_idx" ON "memory_insights" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memory_insights_type_idx" ON "memory_insights" USING btree ("insight_type");--> statement-breakpoint
CREATE INDEX "memory_insights_confidence_idx" ON "memory_insights" USING btree ("confidence");--> statement-breakpoint
CREATE INDEX "memory_items_cognitive_type_idx" ON "memory_items" USING btree ("cognitive_type");