import { pgTable, uuid, text, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

/**
 * Agent daily logs - heartbeat/diary system
 */
export const agentDailyLogs = pgTable('agent_daily_logs', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	logDate: varchar('log_date', { length: 10 }).notNull(), // YYYY-MM-DD format
	content: text().notNull(),
	createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
	userDateIdx: index('agent_daily_logs_user_date_idx').on(table.userId, table.logDate),
	uniqueUserDate: uniqueIndex('agent_daily_logs_user_date_unique').on(table.userId, table.logDate),
}));

export const agentDailyLogsRelations = relations(agentDailyLogs, ({ one }) => ({
	user: one(users, {
		fields: [agentDailyLogs.userId],
		references: [users.id],
	}),
}));
