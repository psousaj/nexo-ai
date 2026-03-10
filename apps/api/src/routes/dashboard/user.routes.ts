import { getProvider } from '@/adapters/messaging';
import { env } from '@/config/env';
import { getChannelLinkSuccessMessage } from '@/config/prompts';
import { db } from '@/db';
import { type MessagingChannel, messagingChannelEnum, userChannels, accounts as betterAuthAccounts } from '@/db/schema';
import { accountLinkingService } from '@/services/account-linking-service';
import { preferencesService } from '@/services/preferences-service';
import { userService } from '@/services/user-service';
import type { AuthContext } from '@/types/hono';
import { loggers } from '@/utils/logger';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const MESSAGING_CHANNEL_SET = new Set<MessagingChannel>(messagingChannelEnum.enumValues as MessagingChannel[]);
const toMessagingChannel = (provider: string): MessagingChannel | null => {
	return MESSAGING_CHANNEL_SET.has(provider as MessagingChannel) ? (provider as MessagingChannel) : null;
};

export const userRoutes = new Hono<AuthContext>()
	.get('/profile', async (c) => {
		const userState = c.get('user');
		const user = await userService.getUserById(userState.id);
		if (!user) return c.json({ error: 'User not found' }, 404);
		return c.json({ user });
	})
	.get('/accounts', async (c) => {
		const userState = c.get('user');
		const accounts = await userService.getUserAccounts(userState.id);
		return c.json({ accounts });
	})
	.post('/link/telegram', async (c) => {
		const userState = c.get('user');
		const user = await userService.getUserById(userState.id);
		if (!user) return c.json({ error: 'User not found' }, 404);

		const vinculateCode = await accountLinkingService.generateLinkingToken(user.id, 'telegram', 'link');

		const botUsername = env.TELEGRAM_BOT_USERNAME || 'NexoAIBot';
		const link = `https://t.me/${botUsername}?start=${vinculateCode}`;

		return c.json({ link, vinculateCode });
	})
	.get('/link/discord', async (c) => {
		// Better Auth v1.4 usa /sign-in/<provider>
		const callbackURL = `${env.DASHBOARD_URL}/profile?success=discord`;
		const link = `${env.BETTER_AUTH_URL}/sign-in/discord?callbackURL=${encodeURIComponent(callbackURL)}`;

		return c.json({ link });
	})
	.post('/link/discord-bot', async (c) => {
		const userState = c.get('user');
		const user = await userService.getUserById(userState.id);
		if (!user) return c.json({ error: 'User not found' }, 404);

		const token = await accountLinkingService.generateLinkingToken(user.id, 'discord', 'link');
		const botUsername = env.DISCORD_BOT_USERNAME;

		return c.json({ token, botUsername });
	})
	.get('/link/google', async (c) => {
		// Better Auth v1.4 usa /sign-in/<provider>
		const callbackURL = `${env.DASHBOARD_URL}/profile?success=google`;
		const link = `${env.BETTER_AUTH_URL}/sign-in/google?callbackURL=${encodeURIComponent(callbackURL)}`;

		return c.json({ link });
	})
	// Discord Bot Installation Info
	.get('/discord-bot-info', async (c) => {
		return c.json({
			clientId: env.DISCORD_CLIENT_ID,
			botTokenConfigured: !!env.DISCORD_BOT_TOKEN,
			installUrl: env.DISCORD_CLIENT_ID
				? `https://discord.com/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&permissions=268445712&scope=bot%20applications.commands`
				: null,
			permissions: '268445712',
			scopes: ['bot', 'applications.commands'],
			botUsername: 'NexoAssistente_bot',
		});
	})
	// Detecta se o bot já está instalado num servidor do usuário e auto-vincula o canal se possível
	.get('/discord-bot/status', async (c) => {
		const userState = c.get('user');

		// Canal já vinculado?
		const [existing] = await db
			.select()
			.from(userChannels)
			.where(and(eq(userChannels.userId, userState.id), eq(userChannels.channel, 'discord')))
			.limit(1);

		if (existing) {
			return c.json({ linked: true, reason: 'already_linked' });
		}

		// Tem Discord OAuth?
		const [oauthAccount] = await db
			.select()
			.from(betterAuthAccounts)
			.where(and(eq(betterAuthAccounts.providerId, 'discord'), eq(betterAuthAccounts.userId, userState.id)))
			.limit(1);

		if (!oauthAccount) {
			return c.json({ linked: false, reason: 'no_oauth', hasOAuth: false });
		}

		const discordUserId = oauthAccount.accountId;

		// Verifica se o bot está em algum servidor que o usuário é dono
		const { findGuildOwnedByUser } = await import('@/adapters/messaging/discord-adapter');
		const guild = await findGuildOwnedByUser(discordUserId);

		if (guild) {
			const user = await userService.getUserById(userState.id);
			await userService.linkAccountToUser(userState.id, 'discord' as any, discordUserId, {
				username: user?.name || discordUserId,
			});
			loggers.webhook.info({ userId: userState.id, discordUserId, guildName: guild.name }, '✅ Discord bot auto-linked via status check');
			return c.json({ linked: true, reason: 'auto_linked', guildName: guild.name });
		}

		return c.json({ linked: false, reason: 'bot_not_installed', hasOAuth: true });
	})
	.post('/link/consume', zValidator('json', z.object({ vinculateCode: z.string() })), async (c) => {
		const userState = c.get('user');
		const { vinculateCode } = c.req.valid('json');

		const linked = await accountLinkingService.linkTokenAccountToUser(vinculateCode, userState.id);
		if (!linked) return c.json({ error: 'Invalid or expired token' }, 400);

		try {
			const provider = await getProvider(linked.provider);
			const accounts = await userService.getUserAccounts(userState.id);
			const linkedAccount = [...accounts]
				.reverse()
				.find((account: any) => account.type === 'channel' && account.provider === linked.provider);
			const confirmationMessage = getChannelLinkSuccessMessage(linked.provider);

			if (provider && linkedAccount?.externalId) {
				await provider.sendMessage(linkedAccount.externalId, confirmationMessage);
			}
		} catch (error) {
			loggers.webhook.warn(
				{ error, userId: userState.id, provider: linked.provider },
				'Falha ao enviar confirmação de vinculação para o provider',
			);
		}

		return c.json({ success: true });
	})
	.get('/preferences', async (c) => {
		const userState = c.get('user');
		const preferences = await preferencesService.getPreferences(userState.id);
		return c.json(preferences);
	})
	.patch(
		'/preferences',
		zValidator(
			'json',
			z.object({
				assistantName: z.string().optional(),
				notificationsBrowser: z.boolean().optional(),
				notificationsWhatsapp: z.boolean().optional(),
				notificationsEmail: z.boolean().optional(),
				privacyShowMemoriesInSearch: z.boolean().optional(),
				privacyShareAnalytics: z.boolean().optional(),
				appearanceTheme: z.string().optional(),
				appearanceLanguage: z.string().optional(),
			}),
		),
		async (c) => {
			const userState = c.get('user');
			const updates = c.req.valid('json');
			await preferencesService.updatePreferences(userState.id, updates);
			return c.json({ success: true });
		},
	)
	.delete('/accounts/:provider', zValidator('param', z.object({ provider: z.string() })), async (c) => {
		const userState = c.get('user');
		const { provider } = c.req.valid('param');

		try {
			const channel = toMessagingChannel(provider);

			if (channel) {
				// Canal de mensageria (whatsapp/telegram/discord-bot) → remover de user_channels
				await db.delete(userChannels).where(and(eq(userChannels.userId, userState.id), eq(userChannels.channel, channel)));
			} else {
				// OAuth (google, discord-oauth, etc.) → remover de accounts do Better Auth
				await db
					.delete(betterAuthAccounts)
					.where(and(eq(betterAuthAccounts.userId, userState.id), eq(betterAuthAccounts.providerId, provider)));
			}

			loggers.webhook.info({ provider, userId: userState.id }, '🗑️ Conta desvinculada');
			return c.json({ success: true });
		} catch (error) {
			loggers.webhook.error({ error, provider, userId: userState.id }, '❌ Erro ao desvincular conta');
			return c.json({ error: 'Erro ao desvincular conta' }, 500);
		}
	});
