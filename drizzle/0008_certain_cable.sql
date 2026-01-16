CREATE TABLE "semantic_external_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"embedding" vector(1024),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memory_items" ADD COLUMN "semantic_external_item_id" uuid;--> statement-breakpoint
CREATE INDEX "semantic_external_items_external_id_idx" ON "semantic_external_items" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "semantic_external_items_type_idx" ON "semantic_external_items" USING btree ("type");--> statement-breakpoint
CREATE INDEX "semantic_external_items_embedding_idx" ON "semantic_external_items" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
ALTER TABLE "memory_items" ADD CONSTRAINT "memory_items_semantic_external_item_id_semantic_external_items_id_fk" FOREIGN KEY ("semantic_external_item_id") REFERENCES "public"."semantic_external_items"("id") ON DELETE no action ON UPDATE no action;