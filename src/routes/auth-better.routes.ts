import { Hono } from 'hono';
import { auth } from '@/lib/auth';
import { syncOAuthAccount, findUserByEmail } from '@/lib/auth-account-sync-plugin';
import { db } from '@/db';
import { accounts, users } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { loggers } from '@/utils/logger';

export const authRouter = new Hono()
	// Endpoint para dashboard verificar se email já existe antes do OAuth
	.post('/check-email', async (c) => {
		try {
			const { email } = await c.req.json();

			if (!email) {
				return c.json({ error: 'Email é obrigatório' }, 400);
			}

			const existingUser = await findUserByEmail(email);

			return c.json({
				exists: !!existingUser,
				user: existingUser
					? {
							id: existingUser.id,
							name: existingUser.name,
							email: existingUser.email,
						}
					: null,
			});
		} catch (error) {
			loggers.webhook.error({ error }, '❌ Erro em /check-email');
			return c.json({ error: 'Erro ao verificar email' }, 500);
		}
	})
	.all('/*', async (c) => {
		try {
			// Better Auth handler
			const request = c.req.raw;
			const response = await auth.handler(request);

			// Se foi callback OAuth bem-sucedido, sincronizar accounts
			const url = new URL(request.url);
			if (url.pathname.includes('/callback/')) {
				// Aguarda um pouco para garantir que o Better Auth salvou no DB
				setTimeout(async () => {
					try {
						// Busca a conta OAuth mais recente (acabou de ser criada)
						const [recentAccount] = await db
							.select()
							.from(accounts)
							.orderBy(desc(accounts.createdAt))
							.limit(1);

						if (recentAccount) {
						// Busca email do usuário novo
						const [newUser] = await db
							.select()
							.from(users)
							.where(eq(users.id, recentAccount.userId))
							.limit(1);

						if (!newUser?.email) {
							loggers.webhook.warn('⚠️ OAuth callback sem email, pulando detecção de duplicados');
							return;
						}

						// 🔍 DETECÇÃO DE DUPLICADOS: Busca usuário existente com mesmo email
						const [existingUser] = await db
							.select()
							.from(users)
							.where(eq(users.email, newUser.email))
							.orderBy(users.createdAt) // Pega o mais antigo (original)
							.limit(2); // Pega 2 para detectar se há duplicado

						const allWithEmail = await db
							.select()
							.from(users)
							.where(eq(users.email, newUser.email));

						// Se há 2+ usuários com mesmo email = duplicação detectada
						if (allWithEmail.length > 1) {
							loggers.webhook.warn(
								{
									email: newUser.email,
									newUserId: newUser.id,
									existingUserId: existingUser.id,
								},
								'⚠️ DUPLICAÇÃO DETECTADA! Mesclando contas...',
							);

							// Mover account para usuário existente
							await db
								.update(accounts)
								.set({ userId: existingUser.id })
								.where(eq(accounts.id, recentAccount.id));

							loggers.webhook.info(
								{ from: newUser.id, to: existingUser.id },
								'✅ Account movido para usuário existente',
							);

							// Deletar usuário duplicado (cascade deleta sessions)
							await db.delete(users).where(eq(users.id, newUser.id));

							loggers.webhook.info({ userId: newUser.id }, '✅ Usuário duplicado deletado');

							// Sincronizar com usuário existente
							await syncOAuthAccount({
								userId: existingUser.id,
								provider: recentAccount.providerId,
								externalId: recentAccount.accountId,
								email: newUser.email,
							});
						} else {
							// Sem duplicação, sincronizar normalmente
							await syncOAuthAccount({
								userId: recentAccount.userId,
								provider: recentAccount.providerId,
								externalId: recentAccount.accountId,
								email: newUser.email,
							});
						}
					}
				} catch (syncError) {
					console.error('⚠️ Erro ao sincronizar OAuth (não crítico):', syncError);
				}
			}, 500); // 500ms de delay
		}

		return response;
	} catch (error) {
		console.error('❌ Better Auth error:', error);
		return c.json({ error: 'Authentication error' }, 500);
	}
});

