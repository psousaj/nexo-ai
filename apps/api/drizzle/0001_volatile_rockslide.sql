CREATE TABLE "agent_memory_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"agents_content" text,
	"soul_content" text,
	"identity_content" text,
	"user_content" text,
	"tools_content" text,
	"memory_content" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_key" varchar(500) NOT NULL,
	"agent_id" varchar(100) DEFAULT 'main',
	"channel" varchar(50) NOT NULL,
	"account_id" varchar(100),
	"peer_kind" varchar(20) NOT NULL,
	"peer_id" varchar(255) NOT NULL,
	"user_id" text,
	"conversation_id" uuid,
	"model" varchar(100),
	"thinking_level" varchar(20),
	"dm_scope" varchar(50) DEFAULT 'per-peer',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_sessions_session_key_unique" UNIQUE("session_key")
);
--> statement-breakpoint
CREATE TABLE "session_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"sequence" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_daily_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"log_date" varchar(10) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_accounts" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "memory_items" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "linking_tokens" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_permissions" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "assistant_emoji" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "assistant_creature" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "assistant_tone" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "assistant_vibe" text;--> statement-breakpoint
ALTER TABLE "agent_memory_profiles" ADD CONSTRAINT "agent_memory_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_transcripts" ADD CONSTRAINT "session_transcripts_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_daily_logs" ADD CONSTRAINT "agent_daily_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_memory_profiles_user_id_idx" ON "agent_memory_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_sessions_session_key_idx" ON "agent_sessions" USING btree ("session_key");--> statement-breakpoint
CREATE INDEX "agent_sessions_user_channel_idx" ON "agent_sessions" USING btree ("user_id","channel");--> statement-breakpoint
CREATE INDEX "agent_sessions_peer_idx" ON "agent_sessions" USING btree ("channel","peer_kind","peer_id");--> statement-breakpoint
CREATE INDEX "session_transcripts_session_idx" ON "session_transcripts" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "session_transcripts_session_sequence_unique" ON "session_transcripts" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE INDEX "agent_daily_logs_user_date_idx" ON "agent_daily_logs" USING btree ("user_id","log_date");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_daily_logs_user_date_unique" ON "agent_daily_logs" USING btree ("user_id","log_date");