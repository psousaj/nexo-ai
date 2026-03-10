import { getProvider } from '@nexo/api-core/adapters/messaging';
import { env } from '@nexo/env';
import { getChannelLinkSuccessMessage } from '@nexo/api-core/config/prompts';
import { db } from '@nexo/api-core/db';
import { type MessagingChannel, messagingChannelEnum, userChannels, accounts as betterAuthAccounts } from '@nexo/api-core/db/schema';
import { accountLinkingService } from '@nexo/api-core/services/account-linking-service';
import { preferencesService } from '@nexo/api-core/services/preferences-service';
import { userService } from '@nexo/api-core/services/user-service';
import { loggers } from '@nexo/api-core/utils/logger';
import { and, eq } from 'drizzle-orm';
import Elysia, { t } from 'elysia';
import { betterAuthPlugin } from '@/plugins/better-auth';

const MESSAGING_CHANNEL_SET = new Set<MessagingChannel>(messagingChannelEnum.enumValues as MessagingChannel[]);
const toMessagingChannel = (provider: string): MessagingChannel | null =>
	MESSAGING_CHANNEL_SET.has(provider as MessagingChannel) ? (provider as MessagingChannel) : null;

export const userRoutes = new Elysia({ prefix: '/user' })
	.use(betterAuthPlugin)

	.get(
		'/profile',
		async ({ user, set }) => {
			const dbUser = await userService.getUserById(user.id);
			if (!dbUser) {
				set.status = 404;
				return { error: 'User not found' };
			}
			return { user: dbUser };
		},
		{ auth: true },
	)

	.get(
		'/accounts',
		async ({ user }) => {
			const accounts = await userService.getUserAccounts(user.id);
			return { accounts };
		},
		{ auth: true },
	)

	.post(
		'/link/telegram',
		async ({ user, set }) => {
			const dbUser = await userService.getUserById(user.id);
			if (!dbUser) {
				set.status = 404;
				return { error: 'User not found' };
			}

			const vinculateCode = await accountLinkingService.generateLinkingToken(dbUser.id, 'telegram', 'link');
			const botUsername = env.TELEGRAM_BOT_USERNAME || 'NexoAIBot';
			const link = `https://t.me/${botUsername}?start=${vinculateCode}`;
			return { link, vinculateCode };
		},
		{ auth: true },
	)

	.get(
		'/link/discord',
		({ user: _user }) => {
			const callbackURL = `${env.DASHBOARD_URL}/profile?success=discord`;
			const link = `${env.BETTER_AUTH_URL}/sign-in/discord?callbackURL=${encodeURIComponent(callbackURL)}`;
			return { link };
		},
		{ auth: true },
	)

	.post(
		'/link/discord-bot',
		async ({ user, set }) => {
			const dbUser = await userService.getUserById(user.id);
			if (!dbUser) {
				set.status = 404;
				return { error: 'User not found' };
			}
			const token = await accountLinkingService.generateLinkingToken(dbUser.id, 'discord', 'link');
			return { token, botUsername: env.DISCORD_BOT_USERNAME };
		},
		{ auth: true },
	)

	.get(
		'/link/google',
		() => {
			const callbackURL = `${env.DASHBOARD_URL}/profile?success=google`;
			const link = `${env.BETTER_AUTH_URL}/sign-in/google?callbackURL=${encodeURIComponent(callbackURL)}`;
			return { link };
		},
		{ auth: true },
	)

	.get(
		'/discord-bot-info',
		() => ({
			clientId: env.DISCORD_CLIENT_ID,
			botTokenConfigured: !!env.DISCORD_BOT_TOKEN,
			installUrl: env.DISCORD_CLIENT_ID
				? `https://discord.com/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&permissions=268445712&scope=bot%20applications.commands`
				: null,
			permissions: '268445712',
			scopes: ['bot', 'applications.commands'],
			botUsername: 'NexoAssistente_bot',
		}),
		{ auth: true },
	)

	.get(
		'/discord-bot/status',
		async ({ user }) => {
			const [existing] = await db
				.select()
				.from(userChannels)
				.where(and(eq(userChannels.userId, user.id), eq(userChannels.channel, 'discord')))
				.limit(1);

			if (existing) return { linked: true, reason: 'already_linked' };

			const [oauthAccount] = await db
				.select()
				.from(betterAuthAccounts)
				.where(and(eq(betterAuthAccounts.providerId, 'discord'), eq(betterAuthAccounts.userId, user.id)))
				.limit(1);

			if (!oauthAccount) return { linked: false, reason: 'no_oauth', hasOAuth: false };

			const discordUserId = oauthAccount.accountId;
			const { findGuildOwnedByUser } = await import('@nexo/api-core/adapters/messaging/discord-adapter');
			const guild = await findGuildOwnedByUser(discordUserId);

			if (guild) {
				const dbUser = await userService.getUserById(user.id);
				await userService.linkAccountToUser(user.id, 'discord' as any, discordUserId, {
					username: dbUser?.name || discordUserId,
				});
				loggers.webhook.info({ userId: user.id, discordUserId, guildName: guild.name }, '✅ Discord bot auto-linked via status check');
				return { linked: true, reason: 'auto_linked', guildName: guild.name };
			}

			return { linked: false, reason: 'bot_not_installed', hasOAuth: true };
		},
		{ auth: true },
	)

	.post(
		'/link/consume',
		async ({ user, body, set }) => {
			const { vinculateCode } = body;
			const linked = await accountLinkingService.linkTokenAccountToUser(vinculateCode, user.id);
			if (!linked) {
				set.status = 400;
				return { error: 'Invalid or expired token' };
			}

			try {
				const provider = await getProvider(linked.provider);
				const accounts = await userService.getUserAccounts(user.id);
				const linkedAccount = [...accounts]
					.reverse()
					.find((account: any) => account.type === 'channel' && account.provider === linked.provider);
				const confirmationMessage = getChannelLinkSuccessMessage(linked.provider);
				if (provider && linkedAccount?.externalId) {
					await provider.sendMessage(linkedAccount.externalId, confirmationMessage);
				}
			} catch (err) {
				loggers.webhook.warn({ err, userId: user.id, provider: linked.provider }, 'Falha ao enviar confirmação de vinculação');
			}

			return { success: true };
		},
		{
			auth: true,
			body: t.Object({ vinculateCode: t.String() }),
		},
	)

	.get(
		'/preferences',
		async ({ user }) => {
			const preferences = await preferencesService.getPreferences(user.id);
			return preferences;
		},
		{ auth: true },
	)

	.patch(
		'/preferences',
		async ({ user, body }) => {
			await preferencesService.updatePreferences(user.id, body);
			return { success: true };
		},
		{
			auth: true,
			body: t.Object({
				assistantName: t.Optional(t.String()),
				notificationsBrowser: t.Optional(t.Boolean()),
				notificationsWhatsapp: t.Optional(t.Boolean()),
				notificationsEmail: t.Optional(t.Boolean()),
				privacyShowMemoriesInSearch: t.Optional(t.Boolean()),
				privacyShareAnalytics: t.Optional(t.Boolean()),
				appearanceTheme: t.Optional(t.String()),
				appearanceLanguage: t.Optional(t.String()),
			}),
		},
	)

	.delete(
		'/accounts/:provider',
		async ({ user, params, set }) => {
			const { provider } = params;
			try {
				const channel = toMessagingChannel(provider);
				if (channel) {
					await db.delete(userChannels).where(and(eq(userChannels.userId, user.id), eq(userChannels.channel, channel)));
				} else {
					await db
						.delete(betterAuthAccounts)
						.where(and(eq(betterAuthAccounts.userId, user.id), eq(betterAuthAccounts.providerId, provider)));
				}
				loggers.webhook.info({ provider, userId: user.id }, '🗑️ Conta desvinculada');
				return { success: true };
			} catch (err) {
				loggers.webhook.error({ err, provider, userId: user.id }, '❌ Erro ao desvincular conta');
				set.status = 500;
				return { error: 'Erro ao desvincular conta' };
			}
		},
		{ auth: true },
	);
