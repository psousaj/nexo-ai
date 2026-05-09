import { index, integer, jsonb, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const memoryEnvelopes = pgTable(
	'memory_envelopes',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		sessionKey: text('session_key').notNull(),
		sourceKind: text('source_kind').notNull(),
		sourceChannel: text('source_channel'),
		schemaVersion: integer('schema_version').default(1).notNull(),
		rawArtifact: jsonb('raw_artifact').notNull(),
		normalizedContent: text('normalized_content').notNull(),
		artifactMetadata: jsonb('artifact_metadata').notNull(),
		confidence: real('confidence').default(1).notNull(),
		relevanceDecay: jsonb('relevance_decay').notNull(),
		audit: jsonb('audit').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => ({
		userIdIdx: index('memory_envelopes_user_id_idx').on(table.userId),
		sessionKeyIdx: index('memory_envelopes_session_key_idx').on(table.sessionKey),
		sourceKindIdx: index('memory_envelopes_source_kind_idx').on(table.sourceKind),
		createdAtIdx: index('memory_envelopes_created_at_idx').on(table.createdAt),
	}),
);
