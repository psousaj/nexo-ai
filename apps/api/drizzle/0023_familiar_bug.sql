CREATE TABLE "provider_keys" (
	"provider" varchar(50) PRIMARY KEY NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_fingerprint" text,
	"config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
