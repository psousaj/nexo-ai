import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { agentSessions } from './agent-sessions';

/**
 * Session transcripts - JSONL export format for session history
 * Includes searchText for full-text search (NEX-24)
 */
export const sessionTranscripts = pgTable(
	'session_transcripts',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		sessionId: uuid('session_id')
			.notNull()
			.references(() => agentSessions.id, { onDelete: 'cascade' }),
		// JSONL format
		content: jsonb('content').notNull(), // {"type":"message","role":"user",...}
		sequence: integer('sequence').notNull(),
		/** Extracted text for FTS (populated via trigger or application) */
		searchText: text('search_text'),
		createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
	},
	(table) => ({
		sessionIdx: index('session_transcripts_session_idx').on(table.sessionId, table.sequence),
		uniqueSessionSequence: uniqueIndex('session_transcripts_session_sequence_unique').on(
			table.sessionId,
			table.sequence,
		),
		/** Index for FTS queries on searchText */
		searchTextIdx: index('session_transcripts_search_text_idx').on(table.searchText),
	}),
);

export const sessionTranscriptsRelations = relations(sessionTranscripts, ({ one }) => ({
	session: one(agentSessions, {
		fields: [sessionTranscripts.sessionId],
		references: [agentSessions.id],
	}),
}));
