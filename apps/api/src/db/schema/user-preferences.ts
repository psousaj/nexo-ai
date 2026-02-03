import { pgTable, uuid, text, timestamp, index, boolean } from 'drizzle-orm/pg-core';
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
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
			.unique(), // one-to-one
		// Nome customizado do assistente (ex: "Maria", "Jarvis")
		assistantName: text('assistant_name'),

		// Notificações
		notificationsBrowser: boolean('notifications_browser').default(true),
		notificationsWhatsapp: boolean('notifications_whatsapp').default(true),
		notificationsEmail: boolean('notifications_email').default(false),

		// Privacidade
		privacyShowMemoriesInSearch: boolean('privacy_show_memories_in_search').default(false),
		privacyShareAnalytics: boolean('privacy_share_analytics').default(true),

		// Aparência
		appearanceTheme: text('appearance_theme').default('dark'),
		appearanceLanguage: text('appearance_language').default('pt-BR'),

		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow(),
	},
	(table) => [index('user_preferences_user_id_idx').on(table.userId)],
);

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
	user: one(users, {
		fields: [userPreferences.userId],
		references: [users.id],
	}),
}));
