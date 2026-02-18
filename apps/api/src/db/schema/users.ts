import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { agentDailyLogs } from './agent-daily-logs';
import { agentMemoryProfiles } from './agent-memory-profiles';
import { agentSessions } from './agent-sessions';
import { conversations } from './conversations';
import { items } from './items';
import { userPermissions } from './permissions';
import { userAccounts } from './user-accounts';
import { userPreferences } from './user-preferences';

/**
 * Usuário único no sistema (entidade de domínio)
 * Pode ter múltiplas contas em diferentes providers via userAccounts
 */
export const users = pgTable('users', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name'),
	email: varchar('email', { length: 255 }).unique(),
	emailVerified: boolean('email_verified').default(false).notNull(),
	image: text('image'),
	password: varchar('password', { length: 256 }),
	createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
	// Controle de onboarding e trial
	status: text('status').$type<'trial' | 'pending_signup' | 'active'>().default('trial').notNull(),
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
	role: text('role').$type<'admin' | 'user'>().default('user').notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
	items: many(items),
	conversations: many(conversations),
	accounts: many(userAccounts),
	preferences: one(userPreferences),
	permissions: many(userPermissions),
	// OpenClaw-inspired relations
	memoryProfiles: many(agentMemoryProfiles),
	agentSessions: many(agentSessions),
	dailyLogs: many(agentDailyLogs),
}));
