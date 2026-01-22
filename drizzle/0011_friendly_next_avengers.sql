CREATE TABLE "error_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"error_type" text NOT NULL,
	"error_message" text NOT NULL,
	"error_stack" text,
	"conversation_history" jsonb,
	"metadata" jsonb,
	"session_id" text,
	"resolved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
