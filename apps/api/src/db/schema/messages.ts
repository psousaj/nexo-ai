import type { MessageRole } from '@/types';
import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { conversations } from './conversations';

export const messages = pgTable(
	'messages',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		conversationId: uuid('conversation_id')
			.notNull()
			.references(() => conversations.id, { onDelete: 'cascade' }),
		role: text('role').$type<MessageRole>().notNull(),
		content: text('content').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => ({
		conversationIdIdx: index('messages_conversation_id_idx').on(table.conversationId),
	}),
);

export const messagesRelations = relations(messages, ({ one }) => ({
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id],
	}),
}));
