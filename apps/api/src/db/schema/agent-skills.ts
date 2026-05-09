import { relations } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Agent Skills — fluxos reutilizáveis que o agente carrega sob demanda
 *
 * Referência: Hermes pattern — skills como YAML/Markdown com trigger conditions,
 * numbered steps, pitfalls e verification.
 */
export const agentSkills = pgTable(
	'agent_skills',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: varchar('name', { length: 128 }).notNull(),
		description: text('description'),
		/** Skill content in Markdown/YAML format with steps, pitfalls, verification */
		content: text('content').notNull(),
		/** Trigger keywords/phrases that auto-load this skill into context */
		triggers: text('triggers').array(),
		enabled: boolean('enabled').default(true).notNull(),
		/** Built-in skills have userId = NULL */
		isBuiltIn: boolean('is_built_in').default(false).notNull(),
		version: integer('version').default(1).notNull(),
		createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
	},
	(table) => ({
		userIdIdx: index('agent_skills_user_id_idx').on(table.userId),
		nameIdx: index('agent_skills_name_idx').on(table.name),
	}),
);

export const agentSkillsRelations = relations(agentSkills, ({ one }) => ({
	user: one(users, {
		fields: [agentSkills.userId],
		references: [users.id],
	}),
}));
