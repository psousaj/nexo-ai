ALTER TABLE "memory_items" DROP CONSTRAINT "memory_items_semantic_external_item_id_semantic_external_items_id_fk";
--> statement-breakpoint
ALTER TABLE "memory_items" ADD CONSTRAINT "memory_items_semantic_ext_item_fk" FOREIGN KEY ("semantic_external_item_id") REFERENCES "public"."semantic_external_items"("id") ON DELETE no action ON UPDATE no action;