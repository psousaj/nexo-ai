import { Hono } from 'hono';
import { env } from '@/config/env';
import { loggers, logError } from '@/utils/logger';
import { userService } from '@/services/user-service';
import { z } from 'zod';

export const discordAuthRoutes = new Hono()
	/**
	 * Callback do OAuth2 do Discord
	 * Recebe o 'code' e um 'state' (que deve ser o userId no MVP simplificado)
	 */
	.get('/callback', async (c) => {
		const { code, state: userId } = c.req.query();

		if (!code || !userId) {
			return c.text('Código ou estado inválido', 400);
		}

		try {
			// 1. Troca o código pelo token de acesso
			const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					client_id: env.DISCORD_CLIENT_ID || '',
					client_secret: env.DISCORD_CLIENT_SECRET || '',
					grant_type: 'authorization_code',
					code,
					redirect_uri: env.DISCORD_REDIRECT_URI || '',
				}),
			});

			if (!tokenResponse.ok) {
				const error = await tokenResponse.json();
				loggers.webhook.error({ error }, 'Erro ao trocar token Discord');
				return c.text('Erro na autenticação com Discord', 500);
			}

			const { access_token } = (await tokenResponse.json()) as { access_token: string };

			// 2. Busca dados do usuário no Discord
			const userResponse = await fetch('https://discord.com/api/users/@me', {
				headers: { Authorization: `Bearer ${access_token}` },
			});

			const discordUser = (await userResponse.json()) as {
				id: string;
				username: string;
				discriminator: string;
				avatar?: string;
			};

			// 3. Vincula a conta ao usuário do sistema
			await userService.linkAccountToUser(userId, 'discord', discordUser.id, {
				username: `${discordUser.username}${discordUser.discriminator !== '0' ? '#' + discordUser.discriminator : ''}`,
				avatarUrl: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : undefined,
			});

			loggers.webhook.info({ userId, discordId: discordUser.id }, '✅ Conta Discord vinculada');

			// 4. Redireciona de volta para o Dashboard
			const dashboardUrl = `${env.APP_URL.replace(':3000', ':5173')}/profile?success=discord`;
			return c.redirect(dashboardUrl);
		} catch (error) {
			logError(error, { context: 'DISCORD_AUTH' });
			return c.text('Erro interno na vinculação', 500);
		}
	});
