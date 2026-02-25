CREATE TYPE "public"."linking_token_provider" AS ENUM('whatsapp', 'telegram', 'discord', 'google');--> statement-breakpoint
CREATE TYPE "public"."linking_token_type" AS ENUM('link', 'signup', 'email_confirm');--> statement-breakpoint
ALTER TABLE "linking_tokens" ALTER COLUMN "token_type" SET DEFAULT 'link'::"public"."linking_token_type";--> statement-breakpoint
ALTER TABLE "linking_tokens" ALTER COLUMN "token_type" SET DATA TYPE "public"."linking_token_type" USING "token_type"::"public"."linking_token_type";--> statement-breakpoint
ALTER TABLE "linking_tokens" ALTER COLUMN "provider" SET DATA TYPE "public"."linking_token_provider" USING "provider"::"public"."linking_token_provider";