import type { ItemMetadata, ItemType } from '@/types';
import { relations } from 'drizzle-orm';
import { foreignKey, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, vector } from 'drizzle-orm/pg-core';
import { semanticExternalItems } from './semantic-external-items';
import { users } from './users';

/**
 * Memory Items - Memórias únicas do usuário
 * Filmes, séries, vídeos, links, notas, etc.
 */
export const memoryItems = pgTable(
	'memory_items',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: text('type').$type<ItemType>().notNull(),
		title: text('title').notNull(),
		/** Identificador único externo (tmdb_id, video_id, url normalizada) */
		externalId: text('external_id'),
		/** Hash SHA-256 do conteúdo para detectar duplicatas */
		contentHash: text('content_hash'),
		metadata: jsonb('metadata').$type<ItemMetadata>(),
		/** Vetor para busca semântica (BGE Small = 384 dims) */
		embedding: vector('embedding', { dimensions: 384 }),
		/** Referência para cache semântico externo (reuso de metadata/embedding) */
		semanticExternalItemId: uuid('semantic_external_item_id'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => ({
		userIdIdx: index('memory_items_user_id_idx').on(table.userId),
		typeIdx: index('memory_items_type_idx').on(table.type),
		metadataIdx: index('memory_items_metadata_idx').using('gin', table.metadata),
		/** Índice para busca vetorial */
		embeddingIdx: index('memory_items_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
		// Índice único: mesmo usuário não pode ter duplicata do mesmo externalId+type
		uniqueExternalIdx: uniqueIndex('memory_items_unique_external_idx').on(table.userId, table.type, table.externalId),
		// Índice único: mesmo usuário não pode ter duplicata do mesmo contentHash
		uniqueContentHashIdx: uniqueIndex('memory_items_unique_content_hash_idx').on(table.userId, table.contentHash),
		semanticExternalItemFk: foreignKey({
			columns: [table.semanticExternalItemId],
			foreignColumns: [semanticExternalItems.id],
			name: 'memory_items_semantic_ext_item_fk',
		}),
	}),
);

// Alias para compatibilidade (deprecado)
export const items = memoryItems;

export const memoryItemsRelations = relations(memoryItems, ({ one }) => ({
	user: one(users, {
		fields: [memoryItems.userId],
		references: [users.id],
	}),
	semanticExternalItem: one(semanticExternalItems, {
		fields: [memoryItems.semanticExternalItemId],
		references: [semanticExternalItems.id],
	}),
}));

// Alias para compatibilidade
export const itemsRelations = memoryItemsRelations;
