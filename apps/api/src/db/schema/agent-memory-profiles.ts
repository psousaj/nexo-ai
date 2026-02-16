import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

/**
 * Agent memory profiles - stores personality and context files
 * Equivalent to OpenClaw's AGENTS.md, SOUL.md, IDENTITY.md, USER.md, etc
 */
export const agentMemoryProfiles = pgTable('agent_memory_profiles', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	// Personality profiles (equivalent to .md files in OpenClaw)
	agentsContent: text('agents_content'), // AGENTS.md: workspace instructions
	soulContent: text('soul_content'), // SOUL.md: personality, voice tone
	identityContent: text('identity_content'), // IDENTITY.md: name, creature, emoji
	userContent: text('user_content'), // USER.md: human user profile
	toolsContent: text('tools_content'), // TOOLS.md: tool documentation
	memoryContent: text('memory_content'), // MEMORY.md: long-term memory
	createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
	userIdIdx: index('agent_memory_profiles_user_id_idx').on(table.userId),
}));

export const agentMemoryProfilesRelations = relations(agentMemoryProfiles, ({ one }) => ({
	user: one(users, {
		fields: [agentMemoryProfiles.userId],
		references: [users.id],
	}),
}));
