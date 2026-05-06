CREATE TABLE "agent_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"triggers" text[],
	"enabled" boolean DEFAULT true NOT NULL,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_registry" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model_id" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0,
	"is_default" boolean DEFAULT false,
	"context_types" jsonb DEFAULT '["chat"]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_skills_user_id_idx" ON "agent_skills" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_skills_name_idx" ON "agent_skills" USING btree ("name");