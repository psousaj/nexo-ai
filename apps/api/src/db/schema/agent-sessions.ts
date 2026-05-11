import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { conversations } from './conversations';
import { sessionTranscripts } from './session-transcripts';
import { users } from './users';

/**
 * Agent sessions - session key management for multi-channel routing
 * OpenClaw-style session keys: agent:{agentId}:{channel}:{peerKind}:{peerId}
 */
export const agentSessions = pgTable(
	'agent_sessions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		sessionKey: varchar('session_key', { length: 500 }).notNull(),
		// Routing info
		agentId: varchar('agent_id', { length: 100 }).default('main'),
		channel: varchar('channel', { length: 50 }).notNull(), // telegram, discord, whatsapp, web
		accountId: varchar('account_id', { length: 100 }), // for multi-account
		peerKind: varchar('peer_kind', { length: 20 }).notNull(), // direct, group, channel
		peerId: varchar('peer_id', { length: 255 }).notNull(), // userId, groupId, channelId
		// Session state
		userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
		conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
		// Metadata
		model: varchar('model', { length: 100 }),
		thinkingLevel: varchar('thinking_level', { length: 20 }),
		dmScope: varchar('dm_scope', { length: 50 }).default('per-peer'), // main, per-peer, per-channel-peer
		// Session chaining for context compression (NEX-73)
		parentSessionId: uuid('parent_session_id').references(() => agentSessions.id, { onDelete: 'set null' }),
		resetReason: varchar('reset_reason', { length: 50 }),
		endedAt: timestamp('ended_at', { mode: 'date' }),
		createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
		lastActivityAt: timestamp('last_activity_at', { mode: 'date' }).defaultNow().notNull(),
		startedAt: timestamp('started_at', { mode: 'date' }).defaultNow().notNull(),
		endedAt: timestamp('ended_at', { mode: 'date' }),
		resetReason: varchar('reset_reason', { length: 50 }),
		parentSessionId: uuid('parent_session_id').references(() => agentSessions.id, { onDelete: 'set null' }),
	},
	(table) => ({
		sessionKeyIdx: index('agent_sessions_session_key_idx').on(table.sessionKey),
		userChannelIdx: index('agent_sessions_user_channel_idx').on(table.userId, table.channel),
		peerIdx: index('agent_sessions_peer_idx').on(table.channel, table.peerKind, table.peerId),
		parentSessionIdx: index('agent_sessions_parent_session_idx').on(table.parentSessionId),
	}),
);

export const agentSessionsRelations = relations(agentSessions, ({ one, many }) => ({
	user: one(users, {
		fields: [agentSessions.userId],
		references: [users.id],
	}),
	conversation: one(conversations, {
		fields: [agentSessions.conversationId],
		references: [conversations.id],
	}),
	transcripts: many(sessionTranscripts),
}));
