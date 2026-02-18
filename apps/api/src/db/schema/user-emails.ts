import { relations } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Múltiplos emails por usuário
 * Permite vincular diferentes providers OAuth com emails diferentes ao mesmo usuário
 */
export const userEmails = pgTable(
	'user_emails',
	{
		id: uuid('id').defaultRandom().primaryKey(),

		/** Referência ao usuário (text para compatibilidade com Better Auth) */
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),

		/** Email do provider */
		email: varchar('email', { length: 255 }).notNull(),

		/** Se é o email principal (usado para notificações, recovery, etc) */
		isPrimary: boolean('is_primary').notNull().default(false),

		/** Provider que forneceu esse email (discord, google, email, etc) */
		provider: varchar('provider', { length: 50 }).notNull(),

		/** Se o email foi verificado */
		verified: boolean('verified').notNull().default(false),

		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => ({
		// Garante que cada email é único globalmente (um email não pode pertencer a múltiplos usuários)
		emailUnique: unique('user_emails_email_unique').on(table.email),
		// Index para buscar emails de um usuário
	}),
);

export const userEmailsRelations = relations(userEmails, ({ one }) => ({
	user: one(users, {
		fields: [userEmails.userId],
		references: [users.id],
	}),
}));
