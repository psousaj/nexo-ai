import { pgTable, uuid, text, timestamp, jsonb, index, varchar, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { items } from './items';
import { conversations } from './conversations';
import { userAccounts } from './user-accounts';
import { userPreferences } from './user-preferences';
import { userPermissions } from './permissions';

/**
 * Usuário único no sistema (entidade de domínio)
 * Pode ter múltiplas contas em diferentes providers via userAccounts
 */
export const users = pgTable('users', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: text('name'),
	email: varchar('email', { length: 255 }).unique(),
	emailVerified: timestamp('email_verified'),
	image: text('image'),
	password: varchar('password', { length: 256 }),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
	// Controle de onboarding e trial
	status: text('status').$type<'trial' | 'pending_signup' | 'active'>().default('trial').notNull(),
	interactionCount: integer('interaction_count').default(0).notNull(),
	// Controle de timeout por comportamento ofensivo
	timeoutUntil: timestamp('timeout_until'),
	offenseCount: integer('offense_count').default(0).notNull(),
	// Nome customizado para o assistente (definido pelo usuário)
	assistantName: text('assistant_name'),
	role: text('role').$type<'admin' | 'user'>().default('user').notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
	items: many(items),
	conversations: many(conversations),
	accounts: many(userAccounts),
	preferences: one(userPreferences),
	permissions: many(userPermissions),
}));
