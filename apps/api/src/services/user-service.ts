import type { ProviderType } from '@/adapters/messaging';
import { cacheDelete, cacheGet, cacheSet } from '@/config/redis';
import { db } from '@/db';
import { authProviders, userAccounts, users } from '@/db/schema';
import { loggers } from '@/utils/logger';
import { and, eq, sql } from 'drizzle-orm';

export class UserService {
	/**
	 * Retorna a chave de cache para uma conta de provider
	 */
	private getAccountCacheKey(provider: ProviderType, externalId: string): string {
		return `user:account:${provider}:${externalId}`;
	}

	/**
	 * Busca ou cria usuário baseado em conta de provider
	 *
	 * Estratégia de unificação cross-provider:
	 * 1. Busca cache por (provider, externalId)
	 * 2. Busca account existente por (provider, externalId)
	 * 3. Se não existe E phoneNumber fornecido, busca account de outro provider com mesmo telefone
	 * 4. Se encontrou usuário existente, cria novo account linkado ao mesmo userId
	 * 5. Caso contrário, cria novo usuário + account
	 */
	async findOrCreateUserByAccount(externalId: string, provider: ProviderType, name?: string, phoneNumber?: string) {
		const cacheKey = this.getAccountCacheKey(provider, externalId);

		// 1a. Tenta buscar do cache
		const cached = await cacheGet<{ user: any; account: any }>(cacheKey);
		if (cached) {
			return cached;
		}

		// 1b. Busca provider account canônico (auth_providers)
		const [existingProviderAccount] = await db
			.select()
			.from(authProviders)
			.where(and(eq(authProviders.provider, provider), eq(authProviders.providerUserId, externalId)))
			.limit(1);

		if (existingProviderAccount) {
			const user = await this.getUserById(existingProviderAccount.userId);
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

		// Fallback legado: user_accounts (deprecar)
		const [existingAccount] = await db
			.select()
			.from(userAccounts)
			.where(and(eq(userAccounts.provider, provider), eq(userAccounts.externalId, externalId)))
			.limit(1);

		if (existingAccount) {
			// Account já existe, retorna usuário associado
			const user = await this.getUserById(existingAccount.userId);
			const result = { user, account: existingAccount };

			// Salva no cache por 1 hora
			await cacheSet(cacheKey, result, 3600);
			return result;
		}

		// 2. Se phoneNumber fornecido, tenta buscar usuário existente por telefone cross-provider
		let userId: string | null = null;

		if (phoneNumber) {
			const [existingAccountByPhone] = await db
				.select()
				.from(userAccounts)
				.where(sql`${userAccounts.metadata}->>'phone' = ${phoneNumber}`)
				.limit(1);

			if (existingAccountByPhone) {
				userId = existingAccountByPhone.userId;
			}
		}

		// 3. Se não encontrou usuário existente, cria novo
		if (!userId) {
			const [newUser] = await db.insert(users).values({ id: crypto.randomUUID(), name }).returning();
			userId = newUser.id;
		}

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

		// Compatibilidade temporária com fluxo legado do dashboard
		await db
			.insert(userAccounts)
			.values({
				userId,
				provider,
				externalId,
				metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
			})
			.onConflictDoNothing();

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
		const [existing] = await db
			.select()
			.from(authProviders)
			.where(and(eq(authProviders.provider, provider), eq(authProviders.providerUserId, externalId)))
			.limit(1);

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

		// Compatibilidade temporária com fluxo legado do dashboard
		await db
			.insert(userAccounts)
			.values({
				userId,
				provider,
				externalId,
				metadata,
			})
			.onConflictDoNothing();

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
		const [account] = await db
			.select()
			.from(authProviders)
			.where(and(eq(authProviders.provider, provider), eq(authProviders.providerUserId, externalId)))
			.limit(1);

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

export const userService = new UserService();
