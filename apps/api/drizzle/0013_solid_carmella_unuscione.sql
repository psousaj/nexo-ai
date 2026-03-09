DROP TABLE "user_emails" CASCADE;--> statement-breakpoint
ALTER TABLE "linking_tokens" ALTER COLUMN "token_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "linking_tokens" ALTER COLUMN "token_type" SET DEFAULT 'link'::text;--> statement-breakpoint
DROP TYPE "public"."linking_token_type";--> statement-breakpoint
CREATE TYPE "public"."linking_token_type" AS ENUM('link', 'signup');--> statement-breakpoint
ALTER TABLE "linking_tokens" ALTER COLUMN "token_type" SET DEFAULT 'link'::"public"."linking_token_type";--> statement-breakpoint
ALTER TABLE "linking_tokens" ALTER COLUMN "token_type" SET DATA TYPE "public"."linking_token_type" USING "token_type"::"public"."linking_token_type";