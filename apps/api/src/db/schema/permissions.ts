import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userPermissions = pgTable('user_permissions', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	action: text('action').notNull(), // 'manage', 'read', 'create', etc.
	subject: text('subject').notNull(), // 'all', 'UserContent', etc.
	conditions: jsonb('conditions'), // Regras dinâmicas do CASL
	inverted: boolean('inverted').default(false).notNull(), // Se a permissão é negativa
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
	user: one(users, {
		fields: [userPermissions.userId],
		references: [users.id],
	}),
}));
