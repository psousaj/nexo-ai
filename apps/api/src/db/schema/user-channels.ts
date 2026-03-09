import { relations } from 'drizzle-orm';
import { boolean, index, pgEnum, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Canais de mensageria vinculados a um usuário — Telegram, WhatsApp, Discord bot.
 *
 * Regras de identidade:
 * - (channel, channelUserId) é único globalmente
 * - (userId, channel) é único por usuário (1 vínculo por canal)
 *
 * Não inclui providers OAuth (Google, Microsoft, Discord OAuth) —
 * esses vivem exclusivamente na tabela `accounts` do Better Auth.
 */
export const messagingChannelEnum = pgEnum('messaging_channel', ['whatsapp', 'telegram', 'discord']);
export type MessagingChannel = (typeof messagingChannelEnum.enumValues)[number];

export const userChannels = pgTable(
	'user_channels',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		channel: messagingChannelEnum('channel').notNull(),
		channelUserId: varchar('channel_user_id', { length: 255 }).notNull(),
		channelEmail: varchar('channel_email', { length: 255 }),
		linkedAt: timestamp('linked_at').defaultNow().notNull(),
		isActive: boolean('is_active').default(true).notNull(),
		metadata: text('metadata'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => ({
		channelIdentityUnique: unique('user_channels_channel_identity_unique').on(table.channel, table.channelUserId),
		userChannelUnique: unique('user_channels_user_channel_unique').on(table.userId, table.channel),
		channelLookupIdx: index('user_channels_channel_lookup_idx').on(table.channel, table.channelUserId),
		userLookupIdx: index('user_channels_user_lookup_idx').on(table.userId),
	}),
);

export const userChannelsRelations = relations(userChannels, ({ one }) => ({
	user: one(users, {
		fields: [userChannels.userId],
		references: [users.id],
	}),
}));
