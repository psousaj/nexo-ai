import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Memory Versions — preserves history of memory_items updates
 *
 * Each time a memory_item is updated (content, metadata, confidence, etc.),
 * the previous version is saved here for audit trail and rollback.
 */
export const memoryVersions = pgTable(
	'memory_versions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		memoryItemId: uuid('memory_item_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		version: integer('version').notNull(),
		type: text('type').notNull(),
		title: text('title'),
		metadata: jsonb('metadata').$type<Record<string, unknown>>(),
		content: text('content'),
		confidence: real('confidence').default(1.0).notNull(),
		importance: real('importance').default(0.5).notNull(),
		source: text('source').default('user').notNull(),
		cognitiveType: text('cognitive_type'),
		changeReason: text('change_reason'),
		createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
	},
	(table) => ({
		memoryItemIdIdx: index('memory_versions_memory_item_id_idx').on(table.memoryItemId),
		userIdIdx: index('memory_versions_user_id_idx').on(table.userId),
		versionIdx: index('memory_versions_version_idx').on(table.memoryItemId, table.version),
	}),
);

export const memoryVersionsRelations = relations(memoryVersions, ({ one }) => ({
	user: one(users, {
		fields: [memoryVersions.userId],
		references: [users.id],
	}),
}));
