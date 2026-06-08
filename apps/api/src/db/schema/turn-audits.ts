import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const turnAudits = pgTable(
	'turn_audits',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		runType: text('run_type').notNull(),
		sessionKey: text('session_key'),
		contextHash: text('context_hash'),
		policies: jsonb('policies').notNull(),
		tools: jsonb('tools').notNull(),
		failures: jsonb('failures'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => ({
		runTypeIdx: index('turn_audits_run_type_idx').on(table.runType),
		sessionKeyIdx: index('turn_audits_session_key_idx').on(table.sessionKey),
	}),
);
