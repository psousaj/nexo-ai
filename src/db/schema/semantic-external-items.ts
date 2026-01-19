import { pgTable, uuid, text, jsonb, vector, timestamp, index } from 'drizzle-orm/pg-core';

export const semanticExternalItems = pgTable(
	'semantic_external_items',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		externalId: text('external_id').notNull(), // id TMDB, YouTube, IMDB etc
		type: text('type').notNull(), // movie, tv_show, video, etc
		provider: text('provider').notNull(), // tmdb, youtube, imdb
		rawData: jsonb('raw_data').notNull(), // JSON bruto da API
		embedding: vector('embedding', { dimensions: 384 }), // BGE Small (384 dims - funcional)
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => ({
		externalIdIdx: index('semantic_external_items_external_id_idx').on(table.externalId),
		typeIdx: index('semantic_external_items_type_idx').on(table.type),
		embeddingIdx: index('semantic_external_items_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
	}),
);
