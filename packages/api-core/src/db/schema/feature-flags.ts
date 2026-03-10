import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Feature flags para pivot e channel
 * (Tool flags ficam em global_tools — ADR-019)
 *
 * Seed: chamado no startup com FLAG_DEFINITIONS. Após seed, BD é fonte de verdade.
 * Runtime update: PATCH /admin/feature-flags/:key → putConfiguration() sem restart.
 */
export const featureFlags = pgTable(
	'feature_flags',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		key: text('key').notNull().unique(), // 'nexo.pivot.conversation-free', 'nexo.channel.telegram'
		label: text('label').notNull(),
		description: text('description').notNull(),
		category: text('category').notNull(), // 'pivot' | 'channel'
		enabled: boolean('enabled').default(true).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => ({
		keyIdx: index('feature_flags_key_idx').on(table.key),
		categoryIdx: index('feature_flags_category_idx').on(table.category),
	}),
);

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;
