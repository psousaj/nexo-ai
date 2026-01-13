import { pgTable, uuid, text, timestamp, jsonb, index, varchar, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { items } from './items';
import { conversations } from './conversations';
import { userAccounts } from './user-accounts';
import { userPreferences } from './user-preferences';

/**
 * Usuário único no sistema (entidade de domínio)
 * Pode ter múltiplas contas em diferentes providers via userAccounts
 */
export const users = pgTable('users', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: text('full_name'),
	email: varchar({ length: 255 }),
	createdAt: timestamp('created_at').defaultNow(),
	password: varchar('password', { length: 256 }),
	// Controle de timeout por comportamento ofensivo
	timeoutUntil: timestamp('timeout_until'),
	offenseCount: integer('offense_count').default(0).notNull(),
	// Nome customizado para o assistente (definido pelo usuário)
	assistantName: text('assistant_name'),
});

export const usersRelations = relations(users, ({ one, many }) => ({
	items: many(items),
	conversations: many(conversations),
	accounts: many(userAccounts),
	preferences: one(userPreferences),
}));
