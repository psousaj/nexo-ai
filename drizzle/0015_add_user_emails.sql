-- Migration: Create user_emails table for multiple emails support
-- Date: 2026-01-26

CREATE TABLE IF NOT EXISTS "user_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"provider" varchar(50) NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_emails_email_unique" UNIQUE("email")
);

-- Foreign key para users
ALTER TABLE "user_emails" ADD CONSTRAINT "user_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;

-- Index para buscar emails por usuário
CREATE INDEX IF NOT EXISTS "user_emails_user_id_idx" ON "user_emails" ("user_id");

-- Index para buscar por email
CREATE INDEX IF NOT EXISTS "user_emails_email_idx" ON "user_emails" ("email");

-- Comentários
COMMENT ON TABLE "user_emails" IS 'Múltiplos emails por usuário - permite vincular diferentes OAuth providers com emails diferentes';
COMMENT ON COLUMN "user_emails"."is_primary" IS 'Email principal usado para notificações e recuperação de senha';
COMMENT ON COLUMN "user_emails"."provider" IS 'Provider que forneceu o email (discord, google, email, etc)';
