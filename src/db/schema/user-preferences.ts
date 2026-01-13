import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

/**
 * Preferências do usuário
 *
 * Tabela separada para configurações personalizadas.
 * Relação one-to-one com users.
 */
export const userPreferences = pgTable(
	'user_preferences',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
			.unique(), // one-to-one
		// Nome customizado do assistente (ex: "Maria", "Jarvis")
		assistantName: text('assistant_name'),
		// Espaço para futuras preferências...
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow(),
	},
	(table) => [index('user_preferences_user_id_idx').on(table.userId)]
);

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
	user: one(users, {
		fields: [userPreferences.userId],
		references: [users.id],
	}),
}));
