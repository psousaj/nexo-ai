import { relations } from "drizzle-orm/relations";
import { users, userAccounts, userEmails, userPreferences, userPermissions, conversations, messages, memoryItems, account, session, linkingTokens } from "./schema";

export const userAccountsRelations = relations(userAccounts, ({one}) => ({
	user: one(users, {
		fields: [userAccounts.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	userAccounts: many(userAccounts),
	userEmails: many(userEmails),
	userPreferences: many(userPreferences),
	userPermissions: many(userPermissions),
	memoryItems: many(memoryItems),
	accounts: many(account),
	sessions: many(session),
	conversations: many(conversations),
	linkingTokens: many(linkingTokens),
}));

export const userEmailsRelations = relations(userEmails, ({one}) => ({
	user: one(users, {
		fields: [userEmails.userId],
		references: [users.id]
	}),
}));

export const userPreferencesRelations = relations(userPreferences, ({one}) => ({
	user: one(users, {
		fields: [userPreferences.userId],
		references: [users.id]
	}),
}));

export const userPermissionsRelations = relations(userPermissions, ({one}) => ({
	user: one(users, {
		fields: [userPermissions.userId],
		references: [users.id]
	}),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
}));

export const conversationsRelations = relations(conversations, ({one, many}) => ({
	messages: many(messages),
	user: one(users, {
		fields: [conversations.userId],
		references: [users.id]
	}),
}));

export const memoryItemsRelations = relations(memoryItems, ({one}) => ({
	user: one(users, {
		fields: [memoryItems.userId],
		references: [users.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(users, {
		fields: [account.userId],
		references: [users.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(users, {
		fields: [session.userId],
		references: [users.id]
	}),
}));

export const linkingTokensRelations = relations(linkingTokens, ({one}) => ({
	user: one(users, {
		fields: [linkingTokens.userId],
		references: [users.id]
	}),
}));