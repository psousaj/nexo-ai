ALTER TABLE "memory_items" ADD COLUMN "embedding" vector(1024);--> statement-breakpoint
CREATE INDEX "memory_items_embedding_idx" ON "memory_items" USING hnsw ("embedding" vector_cosine_ops);