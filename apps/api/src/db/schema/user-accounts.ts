import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Contas de usuário em diferentes providers (WhatsApp, Telegram, Discord, etc)
 * Permite que um usuário único tenha múltiplas identidades em diferentes plataformas
 */
export const userAccounts = pgTable(
	'user_accounts',
	{
		id: uuid('id').defaultRandom().primaryKey(),

		/** Referência ao usuário único no sistema */
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		/** Tipo de provider (telegram, whatsapp, discord, google) */
		provider: text('provider').$type<'telegram' | 'whatsapp' | 'discord' | 'google'>().notNull(),

		/** ID externo do usuário no provider (chat_id, phone number, user_id) */
		externalId: varchar('external_id', { length: 256 }).notNull(),

		/** Metadados específicos do provider (username, phone, discriminator, etc) */
		metadata: jsonb('metadata').$type<{
			username?: string;
			phone?: string;
			firstName?: string;
			lastName?: string;
			discriminator?: string;
			avatarUrl?: string;
			[key: string]: any;
		}>(),

		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow(),
	},
	(table) => ({
		// Garante que cada externalId é único por provider
		providerExternalIdUnique: unique('provider_external_id_unique').on(table.provider, table.externalId),
	}),
);

export const userAccountsRelations = relations(userAccounts, ({ one }) => ({
	user: one(users, {
		fields: [userAccounts.userId],
		references: [users.id],
	}),
}));
