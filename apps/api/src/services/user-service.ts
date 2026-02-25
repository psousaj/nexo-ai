import type { ProviderType } from '@/adapters/messaging';
import { cacheDelete, cacheGet, cacheSet } from '@/config/redis';
import { db } from '@/db';
import { authProviders, users } from '@/db/schema';
import { instrumentService } from '@/services/service-instrumentation';
import { loggers } from '@/utils/logger';
import { and, eq, sql } from 'drizzle-orm';

export class UserService {
	private async findProviderAccount(provider: ProviderType, externalId: string) {
		try {
			const [account] = await db
				.select()
				.from(authProviders)
				.where(and(sql`${authProviders.provider}::text = ${provider}`, eq(authProviders.providerUserId, externalId)))
				.limit(1);

			return account;
		} catch (error) {
			loggers.webhook.warn(
				{ err: error, provider, externalId },
				'⚠️ Falha no lookup canônico por provider+externalId. Tentando fallback por provider_user_id.',
			);

			const fallbackResult = await db.execute(sql`
				SELECT id, user_id, provider, provider_user_id, provider_email, linked_at, is_active, metadata, created_at, updated_at
				FROM auth_providers
				WHERE provider_user_id = ${externalId}
				LIMIT 1
			`);

			const row = (fallbackResult as any)?.[0] || (fallbackResult as any)?.rows?.[0];
			if (!row) return undefined;

			if (String(row.provider) !== provider) {
				return undefined;
			}

			return {
				id: row.id,
				userId: row.user_id,
				provider: row.provider,
				providerUserId: row.provider_user_id,
				providerEmail: row.provider_email,
				linkedAt: row.linked_at,
				isActive: row.is_active,
				metadata: row.metadata,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			} as typeof authProviders.$inferSelect;
		}
	}

	/**
	 * Retorna a chave de cache para uma conta de provider
	 */
	private getAccountCacheKey(provider: ProviderType, externalId: string): string {
		return `user:account:${provider}:${externalId}`;
	}

	/**
	 * Busca ou cria usuário baseado em conta de provider
	 *
	 * Estratégia canônica de identidade:
	 * 1. Busca cache por (provider, externalId)
	 * 2. Busca account existente por (provider, externalId) em auth_providers
	 * 3. Se não existe, cria novo usuário + vínculo canônico
	 */
	async findOrCreateUserByAccount(externalId: string, provider: ProviderType, name?: string, phoneNumber?: string) {
		const cacheKey = this.getAccountCacheKey(provider, externalId);

		// 1a. Tenta buscar do cache
		const cached = await cacheGet<{ user: any; account: any }>(cacheKey);
		if (cached) {
			const cachedUserId = cached?.user?.id;
			if (cachedUserId) {
				const cachedUser = await this.getUserById(cachedUserId);
				if (cachedUser) {
					return {
						...cached,
						user: cachedUser,
					};
				}
			}

			await cacheDelete(cacheKey);
			loggers.webhook.warn(
				{ provider, externalId, cachedUserId },
				'⚠️ Cache de conta inválido detectado (usuário ausente). Cache invalidado.',
			);
		}

		// 1b. Busca provider account canônico (auth_providers)
		const existingProviderAccount = await this.findProviderAccount(provider, externalId);

		if (existingProviderAccount) {
			const user = await this.getUserById(existingProviderAccount.userId);

			if (!user) {
				await db.delete(authProviders).where(eq(authProviders.id, existingProviderAccount.id));
				await cacheDelete(cacheKey);
				loggers.webhook.warn(
					{ provider, externalId, danglingUserId: existingProviderAccount.userId },
					'⚠️ auth_provider órfão detectado (user inexistente). Vínculo removido para recriação.',
				);
			} else {
				const result = {
					user,
					account: {
						id: existingProviderAccount.id,
						userId: existingProviderAccount.userId,
						provider: existingProviderAccount.provider,
						externalId: existingProviderAccount.providerUserId,
						metadata: this.parseMetadata(existingProviderAccount.metadata),
						providerEmail: existingProviderAccount.providerEmail,
						linkedAt: existingProviderAccount.linkedAt,
					},
				};

				await cacheSet(cacheKey, result, 3600);
				return result;
			}
		}

		const [newUser] = await db.insert(users).values({ id: crypto.randomUUID(), name }).returning();
		const userId = newUser.id;

		// 4. Cria novo account linkado ao usuário
		const metadata: Record<string, any> = {};
		if (name) {
			if (provider === 'telegram') {
				metadata.username = name;
			}
		}
		if (phoneNumber) {
			metadata.phone = phoneNumber;
		}

		const [newAuthProvider] = await db
			.insert(authProviders)
			.values({
				userId,
				provider,
				providerUserId: externalId,
				providerEmail: undefined,
				metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : undefined,
				linkedAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		const user = await this.getUserById(userId);
		const result = {
			user,
			account: {
				id: newAuthProvider.id,
				userId: newAuthProvider.userId,
				provider: newAuthProvider.provider,
				externalId: newAuthProvider.providerUserId,
				metadata,
				providerEmail: newAuthProvider.providerEmail,
				linkedAt: newAuthProvider.linkedAt,
			},
		};

		// Salva no cache
		await cacheSet(cacheKey, result, 3600);

		return result;
	}

	async getUserById(userId: string) {
		const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

		return user;
	}

	/**
	 * Atualiza timeout do usuário e incrementa contador de ofensas
	 */
	async updateUserTimeout(userId: string, timeoutUntil: Date, offenseCount: number) {
		await db
			.update(users)
			.set({
				timeoutUntil,
				offenseCount,
			})
			.where(eq(users.id, userId));
	}

	/**
	 * Atualiza o nome do usuário (se fornecido pelo provider)
	 */
	async updateUserName(userId: string, name: string) {
		await db.update(users).set({ name }).where(eq(users.id, userId));
	}

	/**
	 * Extrai primeiro nome do nome completo
	 */
	getFirstName(fullName?: string | null): string | null {
		if (!fullName) return null;
		return fullName.split(' ')[0];
	}

	/**
	 * Atualiza o nome customizado do assistente para o usuário
	 */
	async updateAssistantName(userId: string, assistantName: string) {
		await db.update(users).set({ assistantName }).where(eq(users.id, userId));
	}
	/**
	 * Vincula uma conta de provider a um usuário existente
	 */
	async linkAccountToUser(userId: string, provider: ProviderType, externalId: string, metadata?: any) {
		const cacheKey = this.getAccountCacheKey(provider, externalId);

		// 1. Verifica vínculo canônico em auth_providers
		const existing = await this.findProviderAccount(provider, externalId);

		if (existing) {
			if (existing.userId === userId) {
				// Já está vinculado ao usuário correto, apenas atualiza metadata se necessário
				if (metadata) {
					await db
						.update(authProviders)
						.set({
							metadata: JSON.stringify({ ...this.parseMetadata(existing.metadata), ...metadata }),
							updatedAt: new Date(),
						})
						.where(eq(authProviders.id, existing.id));

					// Invalida cache pois metadata mudou
					await cacheDelete(cacheKey);
				}
				loggers.webhook.info({ userId, provider, externalId }, '✅ Conta já vinculada ao usuário correto');
				return existing;
			}

			// Conflito: conta já vinculada a outro usuário diferente
			// Esse caso pode acontecer em cenários válidos (ex: migrações, ou Better Auth criando account antes do hook)
			loggers.webhook.warn(
				{
					existingUserId: existing.userId,
					targetUserId: userId,
					provider,
					externalId,
				},
				'⚠️ Conta já vinculada a outro usuário - mantendo vínculo original',
			);

			// NÃO sobrescrever - retornar a existente e avisar
			return {
				id: existing.id,
				userId: existing.userId,
				provider: existing.provider,
				externalId: existing.providerUserId,
				metadata: this.parseMetadata(existing.metadata),
			};
		}

		// 2. Senão existe, cria novo vínculo
		const [newAccount] = await db
			.insert(authProviders)
			.values({
				userId,
				provider,
				providerUserId: externalId,
				metadata: metadata ? JSON.stringify(metadata) : undefined,
				linkedAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		loggers.webhook.info({ userId, provider, externalId }, '✅ Nova conta vinculada');

		// Invalida cache (para garantir que next fetch pegue o novo)
		await cacheDelete(cacheKey);

		return {
			id: newAccount.id,
			userId: newAccount.userId,
			provider: newAccount.provider,
			externalId: newAccount.providerUserId,
			metadata,
		};
	}

	/**
	 * Lista todas as contas vinculadas a um usuário
	 */
	async getUserAccounts(userId: string) {
		const accounts = await db.select().from(authProviders).where(eq(authProviders.userId, userId));

		return accounts.map((account) => ({
			id: account.id,
			userId: account.userId,
			provider: account.provider,
			externalId: account.providerUserId,
			metadata: this.parseMetadata(account.metadata),
			providerEmail: account.providerEmail,
			linkedAt: account.linkedAt,
		}));
	}

	/**
	 * Busca uma conta vinculada por provider e ID externo
	 */
	async findAccount(provider: ProviderType, externalId: string) {
		const account = await this.findProviderAccount(provider, externalId);

		if (!account) return null;

		return {
			id: account.id,
			userId: account.userId,
			provider: account.provider,
			externalId: account.providerUserId,
			metadata: this.parseMetadata(account.metadata),
			providerEmail: account.providerEmail,
			linkedAt: account.linkedAt,
		};
	}

	private parseMetadata(metadata?: string | null) {
		if (!metadata) return {};
		try {
			return JSON.parse(metadata);
		} catch {
			return {};
		}
	}
}

export const userService = instrumentService('user', new UserService());
