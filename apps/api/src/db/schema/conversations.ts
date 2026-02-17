import type { ConversationContext, ConversationState } from '@/types';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { messages } from './messages';
import { users } from './users';

export const conversations = pgTable('conversations', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	state: text('state').$type<ConversationState>().default('idle').notNull(),
	context: jsonb('context').$type<ConversationContext>(),
	closeAt: timestamp('close_at'), // Timestamp para auto-fechamento
	closeJobId: text('close_job_id'), // ID do job no Bull para cancelamento O(1)
	isActive: boolean('is_active').default(true).notNull(), // Apenas 1 conversa ativa por usuário
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
	user: one(users, {
		fields: [conversations.userId],
		references: [users.id],
	}),
	messages: many(messages),
}));
