import { boolean, integer, jsonb, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

export const providers = pgTable('providers', {
	id: serial('id').primaryKey(),
	type: varchar('type', { length: 50 }).notNull(),
	label: varchar('label', { length: 100 }).notNull(),
	enabled: boolean('enabled').notNull().default(true),
	priority: integer('priority').default(0),
	config: jsonb('config').$type<Record<string, string>>().default({}),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow(),
});

export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;
