ALTER TABLE "memory_items" ALTER COLUMN "embedding" SET DATA TYPE vector(768);--> statement-breakpoint
ALTER TABLE "semantic_external_items" ALTER COLUMN "embedding" SET DATA TYPE vector(768);