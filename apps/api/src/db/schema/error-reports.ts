import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const errorReports = pgTable('error_reports', {
	id: uuid('id').defaultRandom().primaryKey(),

	// Detalhes do Erro
	errorType: text('error_type').notNull(),
	errorMessage: text('error_message').notNull(),
	errorStack: text('error_stack'),

	// Contexto Completo (JSONB para flexibilidade)
	conversationHistory: jsonb('conversation_history'),
	metadata: jsonb('metadata'),

	// Rastreamento
	sessionId: text('session_id'), // Hash anônimo
	resolved: boolean('resolved').default(false),

	createdAt: timestamp('created_at').defaultNow(),
});
