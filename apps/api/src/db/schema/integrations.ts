import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Google Calendar Integrations
 *
 * Stores user-specific Google Calendar integration settings and metadata.
 * OAuth tokens are stored in the accounts table by Better Auth.
 */
export const googleCalendarIntegrations = pgTable('google_calendar_integrations', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	primaryCalendarId: text('primary_calendar_id').default('primary'),
	timezone: text('timezone').default('America/Sao_Paulo'),
	syncedAt: timestamp('synced_at', { mode: 'date' }),
	metadata: jsonb('metadata'),
	createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

/**
 * Microsoft To Do Integrations
 *
 * Stores user-specific Microsoft To Do integration settings and metadata.
 * OAuth tokens are stored in the accounts table by Better Auth.
 */
export const microsoftTodoIntegrations = pgTable('microsoft_todo_integrations', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	defaultTaskListId: text('default_task_list_id'),
	syncedAt: timestamp('synced_at', { mode: 'date' }),
	metadata: jsonb('metadata'),
	createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

/**
 * Scheduled Reminders
 *
 * Stores reminder data that will be delivered at scheduled times via Bull MQ.
 */
export const scheduledReminders = pgTable('scheduled_reminders', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description'),
	scheduledFor: timestamp('scheduled_for', { mode: 'date' }).notNull(),
	status: text('status').$type<'pending' | 'sent' | 'cancelled'>().default('pending').notNull(),
	bullJobId: text('bull_job_id'),
	metadata: jsonb('metadata'),
	provider: text('provider').$type<'telegram' | 'whatsapp' | 'discord'>().notNull(),
	externalId: text('external_id').notNull(),
	createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// Relations
export const googleCalendarIntegrationsRelations = relations(googleCalendarIntegrations, ({ one }) => ({
	user: one(users, {
		fields: [googleCalendarIntegrations.userId],
		references: [users.id],
	}),
}));

export const microsoftTodoIntegrationsRelations = relations(microsoftTodoIntegrations, ({ one }) => ({
	user: one(users, {
		fields: [microsoftTodoIntegrations.userId],
		references: [users.id],
	}),
}));

export const scheduledRemindersRelations = relations(scheduledReminders, ({ one }) => ({
	user: one(users, {
		fields: [scheduledReminders.userId],
		references: [users.id],
	}),
}));
