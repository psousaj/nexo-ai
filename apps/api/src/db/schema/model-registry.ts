import { boolean, integer, jsonb, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * AI multi-provider model registry (NEX-53)
 *
 * Stores per-provider model configuration: which models are enabled,
 * their priority, default status, and supported context types.
 */
export const modelRegistry = pgTable('model_registry', {
	id: serial('id').primaryKey(),
	provider: varchar('provider', { length: 50 }).notNull(),
	modelId: varchar('model_id', { length: 255 }).notNull(),
	displayName: varchar('display_name', { length: 255 }),
	enabled: boolean('enabled').notNull().default(true),
	priority: integer('priority').default(0),
	isDefault: boolean('is_default').default(false),
	contextTypes: jsonb('context_types').$type<string[]>().default(['chat']),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow(),
});

export type ModelRegistry = typeof modelRegistry.$inferSelect;
export type NewModelRegistry = typeof modelRegistry.$inferInsert;
