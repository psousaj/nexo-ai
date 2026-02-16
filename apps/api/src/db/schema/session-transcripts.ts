import { pgTable, uuid, jsonb, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { agentSessions } from './agent-sessions';

/**
 * Session transcripts - JSONL export format for session history
 */
export const sessionTranscripts = pgTable('session_transcripts', {
	id: uuid('id').defaultRandom().primaryKey(),
	sessionId: uuid('session_id')
		.notNull()
		.references(() => agentSessions.id, { onDelete: 'cascade' }),
	// JSONL format
	content: jsonb('content').notNull(), // {"type":"message","role":"user",...}
	sequence: integer('sequence').notNull(),
	createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
	sessionIdx: index('session_transcripts_session_idx').on(table.sessionId, table.sequence),
	uniqueSessionSequence: uniqueIndex('session_transcripts_session_sequence_unique').on(table.sessionId, table.sequence),
}));

export const sessionTranscriptsRelations = relations(sessionTranscripts, ({ one }) => ({
	session: one(agentSessions, {
		fields: [sessionTranscripts.sessionId],
		references: [agentSessions.id],
	}),
}));
