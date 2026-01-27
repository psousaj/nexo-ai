-- Migration: Create user_emails table
-- IMPORTANTE: user_id é text (compatível com Better Auth)

DROP TABLE IF EXISTS "user_emails" CASCADE;

CREATE TABLE "user_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"provider" varchar(50) NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_emails_email_unique" UNIQUE("email")
);

ALTER TABLE "user_emails" ADD CONSTRAINT "user_emails_user_id_users_id_fk" 
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "user_emails_user_id_idx" ON "user_emails" ("user_id");
CREATE INDEX "user_emails_email_idx" ON "user_emails" ("email");
