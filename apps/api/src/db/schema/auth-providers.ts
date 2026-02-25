import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Credenciais/provedores de autenticação vinculados a um usuário interno.
 *
 * Regras de identidade:
 * - (provider, providerUserId) é único globalmente
 * - (userId, provider) é único por usuário (1 vínculo por provider)
 */
export const authProviders = pgTable(
	'auth_providers',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		provider: varchar('provider', { length: 50 }).notNull(),
		providerUserId: varchar('provider_user_id', { length: 255 }).notNull(),
		providerEmail: varchar('provider_email', { length: 255 }),
		linkedAt: timestamp('linked_at').defaultNow().notNull(),
		isActive: boolean('is_active').default(true).notNull(),
		metadata: text('metadata'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => ({
		providerIdentityUnique: unique('auth_providers_provider_identity_unique').on(table.provider, table.providerUserId),
		userProviderUnique: unique('auth_providers_user_provider_unique').on(table.userId, table.provider),
		providerLookupIdx: index('auth_providers_provider_lookup_idx').on(table.provider, table.providerUserId),
		userLookupIdx: index('auth_providers_user_lookup_idx').on(table.userId),
	}),
);

export const authProvidersRelations = relations(authProviders, ({ one }) => ({
	user: one(users, {
		fields: [authProviders.userId],
		references: [users.id],
	}),
}));
