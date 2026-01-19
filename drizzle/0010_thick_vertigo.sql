ALTER TABLE "memory_items" ALTER COLUMN "embedding" SET DATA TYPE vector(384);--> statement-breakpoint
ALTER TABLE "semantic_external_items" ALTER COLUMN "embedding" SET DATA TYPE vector(384);