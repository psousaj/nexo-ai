import { db } from '@/db';
import { users, userAccounts } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { ProviderType } from '@/adapters/messaging';

export class UserService {
	/**
	 * Busca ou cria usuário baseado em conta de provider
	 *
	 * Estratégia de unificação cross-provider:
	 * 1. Busca account existente por (provider, externalId)
	 * 2. Se não existe E phoneNumber fornecido, busca account de outro provider com mesmo telefone
	 * 3. Se encontrou usuário existente, cria novo account linkado ao mesmo userId
	 * 4. Caso contrário, cria novo usuário + account
	 */
	async findOrCreateUserByAccount(externalId: string, provider: ProviderType, name?: string, phoneNumber?: string) {
		// 1. Busca account existente para esse provider + externalId
		const [existingAccount] = await db
			.select()
			.from(userAccounts)
			.where(and(eq(userAccounts.provider, provider), eq(userAccounts.externalId, externalId)))
			.limit(1);

		if (existingAccount) {
			// Account já existe, retorna usuário associado
			const user = await this.getUserById(existingAccount.userId);
			return { user, account: existingAccount };
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
			const [newUser] = await db.insert(users).values({ name }).returning();
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

		const [newAccount] = await db
			.insert(userAccounts)
			.values({
				userId,
				provider,
				externalId,
				metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
			})
			.returning();

		const user = await this.getUserById(userId);
		return { user, account: newAccount };
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
		// 1. Verifica se essa conta já está vinculada a ALGUÉM
		const [existing] = await db
			.select()
			.from(userAccounts)
			.where(and(eq(userAccounts.provider, provider), eq(userAccounts.externalId, externalId)))
			.limit(1);

		if (existing) {
			if (existing.userId === userId) {
				// Já está vinculado ao usuário correto, apenas atualiza metadata se necessário
				if (metadata) {
					await db
						.update(userAccounts)
						.set({ metadata: { ...existing.metadata, ...metadata }, updatedAt: new Date() })
						.where(eq(userAccounts.id, existing.id));
				}
				return existing;
			}

			// Conflito: conta já vinculada a outro usuário.
			// Em um cenário real poderíamos unificar usuários, mas no MVP vamos error ou sobrescrever.
			// Vamos sobrescrever o vínculo para o novo userId (re-vinculação)
			const [updated] = await db
				.update(userAccounts)
				.set({ userId, metadata, updatedAt: new Date() })
				.where(eq(userAccounts.id, existing.id))
				.returning();
			return updated;
		}

		// 2. Senão existe, cria novo vínculo
		const [newAccount] = await db
			.insert(userAccounts)
			.values({
				userId,
				provider,
				externalId,
				metadata,
			})
			.returning();

		return newAccount;
	}

	/**
	 * Lista todas as contas vinculadas a um usuário
	 */
	async getUserAccounts(userId: string) {
		return await db.select().from(userAccounts).where(eq(userAccounts.userId, userId));
	}
}

export const userService = new UserService();
