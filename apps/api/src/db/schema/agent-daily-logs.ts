import { relations } from 'drizzle-orm';
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar, vector } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Daily log categories
 */
export const dailyLogCategoryEnum = pgEnum('daily_log_category', [
	'conversation', // Chat interaction summary
	'task', // Task or action performed
	'event', // System event or milestone
	'error', // Error or warning
]);

/**
 * Agent daily logs - heartbeat/diary system
 */
export const agentDailyLogs = pgTable(
	'agent_daily_logs',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		logDate: varchar('log_date', { length: 10 }).notNull(), // YYYY-MM-DD format
		category: dailyLogCategoryEnum('category').default('conversation').notNull(),
		content: text().notNull(),
		embedding: vector('embedding', { dimensions: 384 }),
		createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
	},
	(table) => ({
		userDateIdx: index('agent_daily_logs_user_date_idx').on(table.userId, table.logDate),
		userDateCategoryIdx: index('agent_daily_logs_user_date_category_idx').on(
			table.userId,
			table.logDate,
			table.category,
		),
		uniqueUserDate: uniqueIndex('agent_daily_logs_user_date_unique').on(table.userId, table.logDate),
	}),
);

export const agentDailyLogsRelations = relations(agentDailyLogs, ({ one }) => ({
	user: one(users, {
		fields: [agentDailyLogs.userId],
		references: [users.id],
	}),
}));
