import type { ItemMetadata, ItemType } from '@/types';
import { relations } from 'drizzle-orm';
import {
	foreignKey,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	real,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	vector,
} from 'drizzle-orm/pg-core';
import { semanticExternalItems } from './semantic-external-items';
import { users } from './users';

/**
 * Cognitive memory types — classifies how a memory item relates to the user's cognition
 */
export const cognitiveTypeEnum = pgEnum('cognitive_type', [
	'event', // Something that happened (episodic)
	'fact', // A concrete fact (semantic)
	'preference', // User preference or taste
	'pattern', // Recurring behavior or pattern
	'insight', // Derived insight from multiple memories
	'note', // Generic note (default)
]);

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
		// --- Cognitive memory fields (NEX-21) ---
		/** Tipo cognitivo: como esta memória se conecta com a cognição do usuário */
		cognitiveType: cognitiveTypeEnum('cognitive_type').default('note').notNull(),
		/** Nível de confiança desta memória (0-1) */
		confidence: real('confidence').default(1.0).notNull(),
		/** Nível de importância desta memória (0-1) */
		importance: real('importance').default(0.5).notNull(),
		/** Fonte: user (digitado), system (automático), inference (derivado) */
		source: text('source').default('user').notNull(),
		/** Versão da memória (incrementada a cada atualização significativa) */
		version: integer('version').default(1).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => ({
		userIdIdx: index('memory_items_user_id_idx').on(table.userId),
		typeIdx: index('memory_items_type_idx').on(table.type),
		cognitiveTypeIdx: index('memory_items_cognitive_type_idx').on(table.cognitiveType),
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
