import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Tokens temporários para vinculação de contas (Deep Linking Telegram/Discord)
 * Expira em 10 minutos por padrão.
 */
export const linkingTokens = pgTable(
	'linking_tokens',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		tokenType: text('token_type').$type<'link' | 'signup' | 'email_confirm'>().notNull().default('link'),
		provider: text('provider').$type<'whatsapp' | 'telegram' | 'discord' | 'google'>(),
		expiresAt: timestamp('expires_at').notNull(),
		externalId: text('external_id'),
		createdAt: timestamp('created_at').defaultNow(),
	},
	(table) => [index('linking_tokens_token_idx').on(table.token), index('linking_tokens_user_id_idx').on(table.userId)],
);

export const linkingTokensRelations = relations(linkingTokens, ({ one }) => ({
	user: one(users, {
		fields: [linkingTokens.userId],
		references: [users.id],
	}),
}));
