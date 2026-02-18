import { pgTable, foreignKey, unique, uuid, text, varchar, jsonb, timestamp, boolean, index, vector, uniqueIndex, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const userAccounts = pgTable("user_accounts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	provider: text().notNull(),
	externalId: varchar("external_id", { length: 256 }).notNull(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_accounts_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("provider_external_id_unique").on(table.provider, table.externalId),
]);

export const userEmails = pgTable("user_emails", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	email: varchar({ length: 255 }).notNull(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	provider: varchar({ length: 50 }).notNull(),
	verified: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_emails_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("user_emails_email_unique").on(table.email),
]);

export const userPreferences = pgTable("user_preferences", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	assistantName: text("assistant_name"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	notificationsBrowser: boolean("notifications_browser").default(true),
	notificationsWhatsapp: boolean("notifications_whatsapp").default(true),
	notificationsEmail: boolean("notifications_email").default(false),
	privacyShowMemoriesInSearch: boolean("privacy_show_memories_in_search").default(false),
	privacyShareAnalytics: boolean("privacy_share_analytics").default(true),
	appearanceTheme: text("appearance_theme").default('dark'),
	appearanceLanguage: text("appearance_language").default('pt-BR'),
}, (table) => [
	index("user_preferences_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_preferences_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("user_preferences_user_id_unique").on(table.userId),
]);

export const userPermissions = pgTable("user_permissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	action: text().notNull(),
	subject: text().notNull(),
	conditions: jsonb(),
	inverted: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_permissions_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const semanticExternalItems = pgTable("semantic_external_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	externalId: text("external_id").notNull(),
	type: text().notNull(),
	provider: text().notNull(),
	rawData: jsonb("raw_data").notNull(),
	embedding: vector({ dimensions: 384 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("semantic_external_items_embedding_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	index("semantic_external_items_external_id_idx").using("btree", table.externalId.asc().nullsLast().op("text_ops")),
	index("semantic_external_items_type_idx").using("btree", table.type.asc().nullsLast().op("text_ops")),
]);

export const errorReports = pgTable("error_reports", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	errorType: text("error_type").notNull(),
	errorMessage: text("error_message").notNull(),
	errorStack: text("error_stack"),
	conversationHistory: jsonb("conversation_history"),
	metadata: jsonb(),
	sessionId: text("session_id"),
	resolved: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const messages = pgTable("messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	conversationId: uuid("conversation_id").notNull(),
	role: text().notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("messages_conversation_id_idx").using("btree", table.conversationId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_conversations_id_fk"
		}).onDelete("cascade"),
]);

export const memoryItems = pgTable("memory_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	type: text().notNull(),
	title: text().notNull(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	externalId: text("external_id"),
	contentHash: text("content_hash"),
	embedding: vector({ dimensions: 384 }),
	semanticExternalItemId: uuid("semantic_external_item_id"),
}, (table) => [
	index("memory_items_embedding_idx").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	index("memory_items_metadata_idx").using("gin", table.metadata.asc().nullsLast().op("jsonb_ops")),
	index("memory_items_type_idx").using("btree", table.type.asc().nullsLast().op("text_ops")),
	uniqueIndex("memory_items_unique_content_hash_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.contentHash.asc().nullsLast().op("text_ops")),
	uniqueIndex("memory_items_unique_external_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.type.asc().nullsLast().op("text_ops"), table.externalId.asc().nullsLast().op("text_ops")),
	index("memory_items_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "memory_items_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: text().primaryKey().notNull(),
	name: text(),
	email: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	password: varchar({ length: 256 }),
	timeoutUntil: timestamp("timeout_until", { mode: 'string' }),
	offenseCount: integer("offense_count").default(0).notNull(),
	assistantName: text("assistant_name"),
	// OpenClaw-inspired personality fields
	assistantEmoji: text("assistant_emoji"),
	assistantCreature: text("assistant_creature"),
	assistantTone: varchar("assistant_tone", { length: 50 }), // friendly, professional, playful, etc
	assistantVibe: text("assistant_vibe"),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	status: text().default('trial').notNull(),
	interactionCount: integer("interaction_count").default(0).notNull(),
	role: text().default('user').notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
});

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "account_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "session_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("session_token_unique").on(table.token),
]);

export const conversations = pgTable("conversations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	state: text().default('idle').notNull(),
	context: jsonb(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	closeAt: timestamp("close_at", { mode: 'string' }),
	closeJobId: text("close_job_id"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "conversations_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const linkingTokens = pgTable("linking_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	token: text().notNull(),
	provider: text(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	tokenType: text("token_type").default('link').notNull(),
	externalId: text("external_id"),
}, (table) => [
	index("linking_tokens_token_idx").using("btree", table.token.asc().nullsLast().op("text_ops")),
	index("linking_tokens_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "linking_tokens_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("linking_tokens_token_unique").on(table.token),
]);

// ============================================================================
// OPENCLAW-INSPIRED TABLES
// ============================================================================

/**
 * Agent memory profiles - stores personality and context files
 * Equivalent to OpenClaw's AGENTS.md, SOUL.md, IDENTITY.md, USER.md, etc
 */
export const agentMemoryProfiles = pgTable("agent_memory_profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	// Personality profiles (equivalent to .md files in OpenClaw)
	agentsContent: text("agents_content"), // AGENTS.md: workspace instructions
	soulContent: text("soul_content"), // SOUL.md: personality, voice tone
	identityContent: text("identity_content"), // IDENTITY.md: name, creature, emoji
	userContent: text("user_content"), // USER.md: human user profile
	toolsContent: text("tools_content"), // TOOLS.md: tool documentation
	memoryContent: text("memory_content"), // MEMORY.md: long-term memory
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("agent_memory_profiles_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "agent_memory_profiles_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("agent_memory_profiles_user_id_unique").on(table.userId),
]);

/**
 * Agent sessions - session key management for multi-channel routing
 * OpenClaw-style session keys: agent:{agentId}:{channel}:{peerKind}:{peerId}
 */
export const agentSessions = pgTable("agent_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionKey: varchar("session_key", { length: 500 }).notNull().unique(),
	// Routing info
	agentId: varchar("agent_id", { length: 100 }).default('main'),
	channel: varchar("channel", { length: 50 }).notNull(), // telegram, discord, whatsapp, web
	accountId: varchar("account_id", { length: 100 }), // for multi-account
	peerKind: varchar("peer_kind", { length: 20 }).notNull(), // direct, group, channel
	peerId: varchar("peer_id", { length: 255 }).notNull(), // userId, groupId, channelId
	// Session state
	userId: text("user_id"),
	conversationId: uuid("conversation_id"),
	// Metadata
	model: varchar("model", { length: 100 }),
	thinkingLevel: varchar("thinking_level", { length: 20 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	lastActivityAt: timestamp("last_activity_at", { mode: 'string' }).defaultNow().notNull(),
	// Isolation control
	dmScope: varchar("dm_scope", { length: 50 }).default('per-peer'), // main, per-peer, per-channel-peer
}, (table) => [
	index("agent_sessions_session_key_idx").using("btree", table.sessionKey.asc().nullsLast().op("text_ops")),
	index("agent_sessions_user_channel_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.channel.asc().nullsLast().op("text_ops")),
	index("agent_sessions_peer_idx").using("btree", table.channel.asc().nullsLast().op("text_ops"), table.peerKind.asc().nullsLast().op("text_ops"), table.peerId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "agent_sessions_user_id_users_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "agent_sessions_conversation_id_conversations_id_fk"
		}).onDelete("set null"),
]);

/**
 * Session transcripts - JSONL export format for session history
 */
export const sessionTranscripts = pgTable("session_transcripts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	// JSONL format
	content: jsonb("content").notNull(), // {"type":"message","role":"user",...}
	sequence: integer("sequence").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("session_transcripts_session_idx").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops"), table.sequence.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [agentSessions.id],
			name: "session_transcripts_session_id_agent_sessions_id_fk"
		}).onDelete("cascade"),
	unique("session_transcripts_session_sequence_unique").on(table.sessionId, table.sequence),
]);

/**
 * Agent daily logs - heartbeat/diary system
 */
export const agentDailyLogs = pgTable("agent_daily_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	logDate: varchar("log_date", { length: 10 }).notNull(), // YYYY-MM-DD format
	content: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("agent_daily_logs_user_date_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.logDate.desc().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "agent_daily_logs_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("agent_daily_logs_user_date_unique").on(table.userId, table.logDate),
]);
