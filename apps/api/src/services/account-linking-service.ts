import type { ProviderType } from '@/adapters/messaging';
import { cacheDelete } from '@/config/redis';
import { db } from '@/db';
import { accounts as betterAuthAccounts, authProviders, conversations, linkingTokens, memoryItems, users } from '@/db/schema';
import type { LinkingTokenProvider, LinkingTokenType } from '@/db/schema';
import { loggers } from '@/utils/logger';
import { and, eq, gte } from 'drizzle-orm';
import { userService } from './user-service';

export class AccountLinkingService {
	/**
	 * Gera um token único para vinculação de conta ou cadastro
	 * Link: Expira em 10 minutos
	 * Signup: Expira em 24 horas
	 */
	async generateLinkingToken(
		userId: string,
		provider?: ProviderType,
		tokenType: LinkingTokenType = 'link',
		externalId?: string,
	): Promise<string> {
		const tokenFilters = [
			eq(linkingTokens.userId, userId),
			eq(linkingTokens.tokenType, tokenType),
			gte(linkingTokens.expiresAt, new Date()),
		];

		if (provider) {
			tokenFilters.push(eq(linkingTokens.provider, provider));
		}

		if (externalId) {
			tokenFilters.push(eq(linkingTokens.externalId, externalId));
		}

		// Verifica se já existe um token válido (não expirado) para reutilizar
		const existingToken = await db
			.select()
			.from(linkingTokens)
			.where(and(...tokenFilters))
			.limit(1);

		if (existingToken.length > 0) {
			return existingToken[0].token;
		}

		// Gera um token aleatório de 12 caracteres (base64url safe)
		const token = Math.random().toString(36).substring(2, 10).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

		const expiresAt = new Date();
		if (tokenType === 'signup') {
			expiresAt.setHours(expiresAt.getHours() + 24);
		} else if (tokenType === 'email_confirm') {
			expiresAt.setMinutes(expiresAt.getMinutes() + 30);
		} else {
			expiresAt.setMinutes(expiresAt.getMinutes() + 10);
		}

		const cleanupFilters = [eq(linkingTokens.userId, userId), eq(linkingTokens.tokenType, tokenType)];

		if (provider) {
			cleanupFilters.push(eq(linkingTokens.provider, provider));
		}

		if (externalId) {
			cleanupFilters.push(eq(linkingTokens.externalId, externalId));
		}

		// Remove tokens expirados do mesmo user/provider/type para limpar
		await db.delete(linkingTokens).where(and(...cleanupFilters));

		await db.insert(linkingTokens).values({
			userId,
			token,
			tokenType,
			provider,
			externalId,
			expiresAt,
		});

		return token;
	}

	/**
	 * Fluxo 1: Dashboard -> Bot (Deep Linking)
	 * O usuário está logado no Dashboard, gera um token, e envia para o Bot.
	 * O Bot recebe o token e o externalId (ex: Telegram ID).
	 * Vinculamos o externalId ao userId contido no token.
	 */
	async linkExternalAccountByToken(
		token: string,
		externalId: string,
		metadata?: any,
	): Promise<{ userId: string; provider: LinkingTokenProvider } | null> {
		const [linkToken] = await db
			.select()
			.from(linkingTokens)
			.where(and(eq(linkingTokens.token, token), gte(linkingTokens.expiresAt, new Date())))
			.limit(1);

		if (!linkToken || !linkToken.provider) return null;

		// Vincula a conta no UserService
		await userService.linkAccountToUser(linkToken.userId, linkToken.provider, externalId, metadata);

		// Remove o token após uso
		await db.delete(linkingTokens).where(eq(linkingTokens.id, linkToken.id));

		return { userId: linkToken.userId, provider: linkToken.provider };
	}

	/**
	 * Fluxo 2: Bot -> Dashboard (signup ou link)
	 *
	 * Para tokenType = 'signup' (fluxo WhatsApp/Telegram trial → conta real):
	 *   - Migra TODOS os dados do usuário trial para o novo usuário Better Auth
	 *   - authProviders, memory_items e conversations são reatribuídos
	 *   - Novo usuário recebe status 'active'
	 *
	 * Para tokenType = 'link' (usuário já autenticado quer vincular bot):
	 *   - Apenas vincula a conta do bot ao usuário do Dashboard
	 */
	async linkTokenAccountToUser(token: string, targetUserId: string): Promise<{ userId: string; provider: LinkingTokenProvider } | null> {
		const [linkToken] = await db
			.select()
			.from(linkingTokens)
			.where(and(eq(linkingTokens.token, token), gte(linkingTokens.expiresAt, new Date())))
			.limit(1);

		if (!linkToken || !linkToken.provider) return null;

		const trialUserId = linkToken.userId;
		const provider = linkToken.provider;

		if (linkToken.tokenType === 'signup') {
			// Migração completa: trial user → conta real
			await this.migrateTrialUserToAccount(trialUserId, targetUserId, provider);
		} else {
			// Vínculo simples (link manual code)
			const accounts = await userService.getUserAccounts(trialUserId);
			const accountToLink = accounts.find((a: any) => a.provider === provider);
			if (!accountToLink) return null;

			await userService.linkAccountToUser(targetUserId, provider, accountToLink.externalId, accountToLink.metadata);
		}

		// Remove o token após uso
		await db.delete(linkingTokens).where(eq(linkingTokens.id, linkToken.id));

		return { userId: targetUserId, provider };
	}

	/**
	 * Migra TODOS os dados de um usuário trial para um usuário Better Auth recém-criado.
	 *
	 * Executa:
	 * 1. Reatribui authProviders (provider accounts do bot)
	 * 2. Migra memory_items (itens salvos durante o trial)
	 * 3. Migra conversations (histórico)
	 * 4. Ativa o novo usuário (status → active)
	 * 5. Invalida cache das contas migradas
	 */
	private async migrateTrialUserToAccount(trialUserId: string, targetUserId: string, provider: ProviderType): Promise<void> {
		if (trialUserId === targetUserId) {
			loggers.webhook.warn({ trialUserId, targetUserId, provider }, '⚠️ Migração ignorada: trialUserId igual ao targetUserId');
			return;
		}

		loggers.webhook.info({ trialUserId, targetUserId, provider }, '🔄 Iniciando migração trial → conta real');

		// Busca contas do trial user antes de migrar (para invalidar cache depois)
		const trialAccounts = await userService.getUserAccounts(trialUserId);

		// 1. Migra authProviders: reatribui do trial para o target
		await db.update(authProviders).set({ userId: targetUserId, updatedAt: new Date() }).where(eq(authProviders.userId, trialUserId));

		// 2. Migra memory_items
		await db.update(memoryItems).set({ userId: targetUserId }).where(eq(memoryItems.userId, trialUserId));

		// 3. Migra conversations
		await db.update(conversations).set({ userId: targetUserId }).where(eq(conversations.userId, trialUserId));

		// 4. Ativa o novo usuário
		await db.update(users).set({ status: 'active', updatedAt: new Date() }).where(eq(users.id, targetUserId));

		// 5. Invalida cache de todas as contas migradas
		for (const account of trialAccounts) {
			const cacheKey = `user:account:${account.provider}:${account.externalId}`;
			await cacheDelete(cacheKey);
		}

		// 6. Cleanup do usuário trial: remove se não restou vínculo
		const [remainingAuthProvider] = await db
			.select({ id: authProviders.id })
			.from(authProviders)
			.where(eq(authProviders.userId, trialUserId))
			.limit(1);

		const [remainingBetterAuthAccount] = await db
			.select({ id: betterAuthAccounts.id })
			.from(betterAuthAccounts)
			.where(eq(betterAuthAccounts.userId, trialUserId))
			.limit(1);

		if (!remainingAuthProvider && !remainingBetterAuthAccount) {
			await db.delete(users).where(and(eq(users.id, trialUserId), eq(users.status, 'trial')));
			loggers.webhook.info({ trialUserId, targetUserId }, '🧹 Usuário trial órfão removido após migração');
		} else {
			loggers.webhook.warn(
				{
					trialUserId,
					hasAuthProvider: !!remainingAuthProvider,
					hasBetterAuthAccount: !!remainingBetterAuthAccount,
				},
				'⚠️ Cleanup do trial ignorado: ainda existem vínculos',
			);
		}

		loggers.webhook.info(
			{
				trialUserId,
				targetUserId,
				migratedAccounts: trialAccounts.length,
			},
			'✅ Migração concluída: trial → conta real',
		);
	}
}

export const accountLinkingService = new AccountLinkingService();
