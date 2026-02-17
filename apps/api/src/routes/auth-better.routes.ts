import { db } from '@/db';
import { accounts, sessions, users } from '@/db/schema';
import { authPlugin } from '@/lib/auth';
import { findUserByEmail, syncOAuthAccount } from '@/lib/auth-account-sync-plugin';
import { loggers } from '@/utils/logger';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';

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
			const response = await authPlugin.handler(request);

			// Se foi callback OAuth bem-sucedido, sincronizar accounts
			const url = new URL(request.url);
			if (url.pathname.includes('/callback/')) {
				loggers.webhook.info({ pathname: url.pathname }, '🔔 Callback OAuth detectado');

				// 🔑 TENTATIVA DE LER SESSÃO ANTERIOR (usuário estava logado antes do OAuth?)
				let previousUserId: string | null = null;
				try {
					// Tenta ler sessão do Better Auth ANTES do OAuth criar conta nova
					const sessionData = await authPlugin.api.getSession({ headers: request.headers });
					if (sessionData?.user?.id) {
						previousUserId = sessionData.user.id;
						loggers.webhook.info(
							{ previousUserId, email: sessionData.user.email },
							'👤 Sessão anterior encontrada - usuário estava logado!',
						);
					}
				} catch (_err) {
					loggers.webhook.info('ℹ️ Nenhuma sessão anterior - novo usuário OAuth');
				}

				// Aguarda um pouco para garantir que o Better Auth salvou no DB
				setTimeout(async () => {
					try {
						loggers.webhook.info('⏰ setTimeout executado - iniciando detecção de duplicados');

						// Busca a conta OAuth mais recente (acabou de ser criada)
						const [recentAccount] = await db.select().from(accounts).orderBy(desc(accounts.createdAt)).limit(1);

						if (!recentAccount) {
							loggers.webhook.warn('⚠️ Nenhum account recente encontrado');
							return;
						}

						loggers.webhook.info(
							{ accountId: recentAccount.id, userId: recentAccount.userId },
							'📋 Account recente encontrado',
						);

						// Busca email do usuário novo
						const [newUser] = await db.select().from(users).where(eq(users.id, recentAccount.userId)).limit(1);

						if (!newUser?.email) {
							loggers.webhook.warn('⚠️ OAuth callback sem email, pulando detecção de duplicados');
							return;
						}

						loggers.webhook.info({ userId: newUser.id, email: newUser.email }, '👤 Novo usuário OAuth criado');

						// 🔍 DETECÇÃO DE DUPLICADOS: 2 estratégias

						// Estratégia 1: Verifica se este externalId (Discord ID) já foi usado antes
						const allAccountsWithExternalId = await db
							.select()
							.from(accounts)
							.where(
								and(eq(accounts.providerId, recentAccount.providerId), eq(accounts.accountId, recentAccount.accountId)),
							);

						loggers.webhook.info(
							{
								provider: recentAccount.providerId,
								externalId: recentAccount.accountId,
								count: allAccountsWithExternalId.length,
							},
							'🔍 Busca por Discord ID duplicado',
						);

						if (allAccountsWithExternalId.length > 1) {
							// Mesmo Discord ID usado em 2+ accounts = usuário reconectou
							const oldAccount = allAccountsWithExternalId.sort(
								(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
							)[0];

							const [existingUser] = await db.select().from(users).where(eq(users.id, oldAccount.userId)).limit(1);

							if (existingUser && existingUser.id !== newUser.id) {
								loggers.webhook.warn(
									{
										provider: recentAccount.providerId,
										externalId: recentAccount.accountId,
										oldUserId: existingUser.id,
										oldEmail: existingUser.email,
										newUserId: newUser.id,
										newEmail: newUser.email,
									},
									'⚠️ DUPLICAÇÃO DETECTADA! Mesmo Discord ID usado 2x - mesclando...',
								);

								// Mover account novo para usuário antigo
								await db.update(accounts).set({ userId: existingUser.id }).where(eq(accounts.id, recentAccount.id));

								loggers.webhook.info(
									{ from: newUser.id, to: existingUser.id },
									'✅ Account movido para usuário existente',
								);

								// Deletar usuário duplicado
								await db.delete(users).where(eq(users.id, newUser.id));

								loggers.webhook.info({ userId: newUser.id }, '✅ Usuário duplicado deletado');

								// Extrair username do user
								const accountMetadata = {
									username: newUser.name || recentAccount.accountId || null,
									email: newUser.email || null,
								};

								// Sincronizar com usuário existente (adiciona email como secundário se diferente)
								await syncOAuthAccount({
									userId: existingUser.id,
									provider: recentAccount.providerId,
									externalId: recentAccount.accountId,
									email: newUser.email, // Email do Discord será adicionado como secundário
									metadata: accountMetadata,
								});

								loggers.webhook.info(
									{
										userId: existingUser.id,
										primaryEmail: existingUser.email,
										secondaryEmail: newUser.email,
									},
									'✅ Email do Discord adicionado como email secundário',
								);

								return;
							}
						}

						// Estratégia 2: Se tem sessão anterior (usuário estava logado), SEMPRE vincula a ele
						// (funciona mesmo se email for diferente OU igual)
						if (previousUserId && previousUserId !== newUser.id) {
							const [loggedUser] = await db.select().from(users).where(eq(users.id, previousUserId)).limit(1);

							if (loggedUser) {
								loggers.webhook.warn(
									{
										loggedUserId: loggedUser.id,
										loggedEmail: loggedUser.email,
										newUserId: newUser.id,
										newEmail: newUser.email,
										provider: recentAccount.providerId,
									},
									'⚠️ Vinculando OAuth ao usuário que estava logado...',
								);

								// Mover account para usuário logado
								await db.update(accounts).set({ userId: loggedUser.id }).where(eq(accounts.id, recentAccount.id));

								loggers.webhook.info({ from: newUser.id, to: loggedUser.id }, '✅ Account movido para usuário logado');

								// Buscar metadados do account (nome de usuário, etc)
								const [fullAccount] = await db
									.select()
									.from(accounts)
									.where(eq(accounts.id, recentAccount.id))
									.limit(1);

								// Deletar usuário duplicado que Better Auth criou
								await db.delete(users).where(eq(users.id, newUser.id));

								loggers.webhook.info({ userId: newUser.id }, '✅ Usuário duplicado deletado');

								// Extrair username/email do account metadata
								const accountMetadata = {
									username: newUser.name || fullAccount?.accountId || null,
									email: newUser.email || null,
								};

								// Sincronizar com usuário logado
								await syncOAuthAccount({
									userId: loggedUser.id,
									provider: recentAccount.providerId,
									externalId: recentAccount.accountId,
									email: newUser.email,
									metadata: accountMetadata, // Adiciona username/email
								});

								loggers.webhook.info(
									{
										userId: loggedUser.id,
										primaryEmail: loggedUser.email,
										secondaryEmail: newUser.email,
									},
									'✅ OAuth vinculado! Email adicionado à lista (se diferente)',
								);

								// 🔑 CRÍTICO: Invalida sessão antiga e cria nova para o usuário correto
								// (senão frontend fica com sessão do usuário deletado)
								try {
									// Busca a sessão que acabou de ser criada pelo Better Auth (do usuário deletado)
									const [oldSession] = await db.select().from(sessions).where(eq(sessions.userId, newUser.id)).limit(1);

									if (oldSession) {
										// Atualiza sessão para apontar pro usuário correto
										await db.update(sessions).set({ userId: loggedUser.id }).where(eq(sessions.id, oldSession.id));

										loggers.webhook.info(
											{ sessionId: oldSession.id, newUserId: loggedUser.id },
											'✅ Sessão redirecionada para usuário correto',
										);
									}
								} catch (sessionError) {
									loggers.webhook.error({ error: sessionError }, '⚠️ Erro ao atualizar sessão (não crítico)');
								}

								return;
							}
						}

						// Estratégia 3: Se NÃO tem sessão anterior, busca por email duplicado
						const allWithEmail = await db.select().from(users).where(eq(users.email, newUser.email));

						loggers.webhook.info({ email: newUser.email, count: allWithEmail.length }, '🔍 Busca por email duplicado');

						// Se há 2+ usuários com mesmo email = duplicação detectada
						if (allWithEmail.length > 1) {
							// Pega o mais antigo (preserva histórico)
							const existingUser = allWithEmail.sort(
								(a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime(),
							)[0];

							loggers.webhook.warn(
								{
									email: newUser.email,
									newUserId: newUser.id,
									existingUserId: existingUser.id,
								},
								'⚠️ DUPLICAÇÃO DETECTADA! Mesclando contas...',
							);

							// Mover account para usuário existente
							await db.update(accounts).set({ userId: existingUser.id }).where(eq(accounts.id, recentAccount.id));

							loggers.webhook.info(
								{ from: newUser.id, to: existingUser.id },
								'✅ Account movido para usuário existente',
							);

							// Deletar usuário duplicado (cascade deleta sessions)
							await db.delete(users).where(eq(users.id, newUser.id));

							loggers.webhook.info({ userId: newUser.id }, '✅ Usuário duplicado deletado');

							// Extrair username do Discord
							const accountMeta = {
								username: newUser.name || recentAccount.accountId || null,
								email: newUser.email || null,
							};

							// Sincronizar com usuário existente
							await syncOAuthAccount({
								userId: existingUser.id,
								provider: recentAccount.providerId,
								externalId: recentAccount.accountId,
								email: newUser.email,
								metadata: accountMeta,
							});
						} else {
							loggers.webhook.info({ email: newUser.email }, '✅ Sem duplicação - sincronizando normalmente');

							// Sem duplicação, sincronizar normalmente
							await syncOAuthAccount({
								userId: recentAccount.userId,
								provider: recentAccount.providerId,
								externalId: recentAccount.accountId,
								email: newUser.email,
								metadata: {
									username: newUser.name || recentAccount.accountId || null,
									email: newUser.email || null,
								},
							});
						}
					} catch (syncError) {
						loggers.webhook.error({ error: syncError }, '❌ Erro ao sincronizar OAuth');
					}
				}, 500); // 500ms de delay
			}

			return response;
		} catch (error) {
			console.error('❌ Better Auth error:', error);
			return c.json({ error: 'Authentication error' }, 500);
		}
	});
