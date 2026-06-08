ALTER TABLE "agent_sessions" DROP CONSTRAINT "agent_sessions_session_key_unique";--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "started_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "ended_at" timestamp;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "reset_reason" varchar(50);--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "parent_session_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_parent_session_id_agent_sessions_id_fk" FOREIGN KEY ("parent_session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_sessions_parent_session_idx" ON "agent_sessions" USING btree ("parent_session_id");