-- Reset database: Drop entire public schema and recreate
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Recreate schema from scratch
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "full_name" text,
  "phone" varchar(256)
);

CREATE TABLE "items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "state" text DEFAULT 'idle' NOT NULL,
  "context" jsonb,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign keys
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_users_id_fk" 
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") 
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" 
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") 
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" 
  FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") 
  ON DELETE cascade ON UPDATE no action;

-- Create indexes
CREATE INDEX "items_user_id_idx" ON "items" USING btree ("user_id");
CREATE INDEX "items_type_idx" ON "items" USING btree ("type");
CREATE INDEX "items_metadata_idx" ON "items" USING gin ("metadata");
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");
