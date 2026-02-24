import { env } from '@/config/env';
import { db } from '@/db';
import { accounts as betterAuthAccounts, userAccounts } from '@/db/schema';
import { accountLinkingService } from '@/services/account-linking-service';
import { emailService } from '@/services/email/email.service';
import { preferencesService } from '@/services/preferences-service';
import { userEmailService } from '@/services/user-email-service';
import { userService } from '@/services/user-service';
import type { AuthContext } from '@/types/hono';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

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
	.post('/accounts/sync', async (c) => {
		// Sincroniza accounts do Better Auth com user_accounts (útil para usuários já existentes)
		const userState = c.get('user');
		const userId = userState.id;

		try {
			// Buscar todos os accounts do Better Auth
			const betterAuthAccountsList = await db
				.select()
				.from(betterAuthAccounts)
				.where(eq(betterAuthAccounts.userId, userId));

			console.log(
				`🔄 [Sync] Encontrado ${betterAuthAccountsList.length} account(s) no Better Auth para usuário ${userId}`,
			);

			let synced = 0;
			let skipped = 0;

			for (const account of betterAuthAccountsList) {
				const providerId = account.providerId; // 'discord', 'google', etc
				const accountId = account.accountId; // ID do usuário no provider

				// Verificar se já existe na tabela user_accounts
				const [existingUserAccount] = await db
					.select()
					.from(userAccounts)
					.where(
						and(
							eq(userAccounts.userId, userId),
							eq(userAccounts.provider, providerId as any),
							eq(userAccounts.externalId, accountId),
						),
					)
					.limit(1);

				if (existingUserAccount) {
					console.log(`✅ [Sync] user_account já existe para ${providerId}, pulando`);
					skipped++;
					continue;
				}

				// Buscar dados do usuário para metadata
				const user = await userService.getUserById(userId);

				// Criar metadata baseado no provider
				const metadata: Record<string, any> = {};

				if (providerId === 'discord') {
					metadata.username = user?.name || accountId;
					metadata.avatarUrl = user?.image || null;
				} else if (providerId === 'google') {
					metadata.email = user?.email || null;
				}

				// Criar registro em user_accounts
				await db.insert(userAccounts).values({
					userId,
					provider: providerId as 'discord' | 'google',
					externalId: accountId,
					metadata,
				});

				console.log(`✅ [Sync] user_account criado: ${providerId} -> ${accountId}`);
				synced++;
			}

			return c.json({
				success: true,
				message: `Sincronizado ${synced} conta(s), ${skipped} já existia(m)`,
				synced,
				skipped,
			});
		} catch (error) {
			console.error('❌ [Sync] Erro ao sincronizar accounts:', error);
			return c.json({ error: 'Erro ao sincronizar contas' }, 500);
		}
	})
	.post('/link/telegram', async (c) => {
		const userState = c.get('user');
		const token = await accountLinkingService.generateLinkingToken(userState.id, 'telegram', 'link');

		const botUsername = env.TELEGRAM_BOT_USERNAME || 'NexoAIBot';
		const link = `https://t.me/${botUsername}?start=${token}`;

		return c.json({ link, token });
	})
	.get('/link/discord', async (c) => {
		// Better Auth v1.4 usa /sign-in/<provider>
		const callbackURL = `${env.DASHBOARD_URL}/profile?success=discord`;
		const link = `${env.BETTER_AUTH_URL}/sign-in/discord?callbackURL=${encodeURIComponent(callbackURL)}`;

		return c.json({ link });
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
	.post('/link/consume', zValidator('json', z.object({ token: z.string() })), async (c) => {
		const userState = c.get('user');
		const { token } = c.req.valid('json');

		const linked = await accountLinkingService.linkTokenAccountToUser(token, userState.id);
		if (!linked) return c.json({ error: 'Invalid or expired token' }, 400);

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
	// ============================================================================
	// EMAIL MANAGEMENT ROUTES
	// ============================================================================
	.get('/emails', async (c) => {
		const userState = c.get('user');
		const emails = await userEmailService.getUserEmails(userState.id);
		return c.json({ emails });
	})
	.post(
		'/emails',
		zValidator(
			'json',
			z.object({
				email: z.string().email(),
				provider: z.string().default('manual'),
			}),
		),
		async (c) => {
			const userState = c.get('user');
			const { email, provider } = c.req.valid('json');

			try {
				const newEmail = await userEmailService.addEmail(userState.id, email, provider, false);
				await emailService.sendConfirmationEmail({
					userId: userState.id,
					userName: userState.name || 'usuário',
					email: newEmail.email,
				});

				return c.json({ email: newEmail, confirmationSent: true }, 201);
			} catch (error) {
				return c.json({ error: error instanceof Error ? error.message : 'Erro ao adicionar email' }, 400);
			}
		},
	)
	.post(
		'/emails/:emailId/resend-confirmation',
		zValidator('param', z.object({ emailId: z.string().uuid() })),
		async (c) => {
			const userState = c.get('user');
			const { emailId } = c.req.valid('param');

			const userEmail = await userEmailService.getEmailById(userState.id, emailId);
			if (!userEmail) {
				return c.json({ error: 'Email não encontrado' }, 404);
			}

			if (userEmail.verified) {
				return c.json({ success: true, alreadyVerified: true });
			}

			await emailService.sendConfirmationEmail({
				userId: userState.id,
				userName: userState.name || 'usuário',
				email: userEmail.email,
			});

			return c.json({ success: true });
		},
	)
	.patch('/emails/:emailId/primary', zValidator('param', z.object({ emailId: z.string().uuid() })), async (c) => {
		const userState = c.get('user');
		const { emailId } = c.req.valid('param');

		try {
			await userEmailService.setPrimaryEmail(userState.id, emailId);
			return c.json({ success: true });
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : 'Erro ao definir email primário' }, 400);
		}
	})
	.delete('/emails/:emailId', zValidator('param', z.object({ emailId: z.string().uuid() })), async (c) => {
		const userState = c.get('user');
		const { emailId } = c.req.valid('param');

		try {
			await userEmailService.removeEmail(userState.id, emailId);
			return c.json({ success: true });
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : 'Erro ao remover email' }, 400);
		}
	})
	.delete('/accounts/:provider', zValidator('param', z.object({ provider: z.string() })), async (c) => {
		const userState = c.get('user');
		const { provider } = c.req.valid('param');

		try {
			// Deletar de user_accounts do nosso sistema
			await db
				.delete(userAccounts)
				.where(and(eq(userAccounts.userId, userState.id), eq(userAccounts.provider, provider as any)));

			// Deletar de accounts do Better Auth
			await db
				.delete(betterAuthAccounts)
				.where(and(eq(betterAuthAccounts.userId, userState.id), eq(betterAuthAccounts.providerId, provider)));

			console.log(`🗑️ [Auth] Conta ${provider} desvinculada para usuário ${userState.id}`);

			return c.json({ success: true });
		} catch (error) {
			console.error(`❌ [Auth] Erro ao desvincular conta ${provider}:`, error);
			return c.json({ error: 'Erro ao desvincular conta' }, 500);
		}
	});
