import { relations } from 'drizzle-orm';
import { boolean, integer, pgEnum, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { agentDailyLogs } from './agent-daily-logs';
import { agentMemoryProfiles } from './agent-memory-profiles';
import { agentSessions } from './agent-sessions';
import { authProviders } from './auth-providers';
import { conversations } from './conversations';
import { items } from './items';
import { userPermissions } from './permissions';
import { userPreferences } from './user-preferences';

/**
 * Usuário único no sistema (entidade de domínio)
 * Pode ter múltiplas contas em diferentes providers via authProviders
 */
export const userStatusEnum = pgEnum('user_status', ['trial', 'pending_signup', 'active']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);

export const users = pgTable('users', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name'),
	email: varchar('email', { length: 255 }).unique(),
	emailVerified: boolean('email_verified').default(false).notNull(),
	image: text('image'),
	createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
	// Controle de onboarding e trial
	status: userStatusEnum('status').default('trial').notNull(),
	interactionCount: integer('interaction_count').default(0).notNull(),
	// Controle de timeout por comportamento ofensivo
	timeoutUntil: timestamp('timeout_until', { mode: 'date' }),
	offenseCount: integer('offense_count').default(0).notNull(),
	// Nome customizado para o assistente (definido pelo usuário)
	assistantName: text('assistant_name'),
	// OpenClaw-inspired personality fields
	assistantEmoji: text('assistant_emoji'), // Emoji que representa o assistente
	assistantCreature: text('assistant_creature'), // "creature" (ex: "fox", "owl")
	assistantTone: varchar('assistant_tone', { length: 50 }), // friendly, professional, playful, etc
	assistantVibe: text('assistant_vibe'), // Descrição livre de vibe
	role: userRoleEnum('role').default('user').notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
	items: many(items),
	conversations: many(conversations),
	authProviders: many(authProviders),
	preferences: one(userPreferences),
	permissions: many(userPermissions),
	// OpenClaw-inspired relations
	memoryProfiles: many(agentMemoryProfiles),
	agentSessions: many(agentSessions),
	dailyLogs: many(agentDailyLogs),
}));
