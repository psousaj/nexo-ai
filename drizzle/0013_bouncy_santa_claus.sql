CREATE TABLE "user_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"subject" text NOT NULL,
	"conditions" jsonb,
	"inverted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email_verified" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email_verified" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "linking_tokens" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;