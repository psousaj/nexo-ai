import { db } from '@/db';
import { linkingTokens, userAccounts } from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { userService } from './user-service';
import type { ProviderType } from '@/adapters/messaging';

export class AccountLinkingService {
	/**
	 * Gera um token único para vinculação de conta
	 * Expira em 10 minutos
	 */
	async generateLinkingToken(userId: string, provider: 'telegram' | 'discord'): Promise<string> {
		// Gera um token aleatório de 12 caracteres (base64url safe)
		const token = Math.random().toString(36).substring(2, 10).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

		const expiresAt = new Date();
		expiresAt.setMinutes(expiresAt.getMinutes() + 10);

		// Remove tokens antigos/expirados do mesmo user/provider para limpar
		await db.delete(linkingTokens).where(and(eq(linkingTokens.userId, userId), eq(linkingTokens.provider, provider)));

		await db.insert(linkingTokens).values({
			userId,
			token,
			provider,
			expiresAt,
		});

		return token;
	}

	/**
	 * Consome um token e vincula a conta ao usuário
	 */
	async linkAccountByToken(token: string, externalId: string, metadata?: any): Promise<{ userId: string; provider: string } | null> {
		const [linkToken] = await db
			.select()
			.from(linkingTokens)
			.where(and(eq(linkingTokens.token, token), gte(linkingTokens.expiresAt, new Date())))
			.limit(1);

		if (!linkToken) return null;

		// Vincula a conta no UserService
		await userService.linkAccountToUser(linkToken.userId, linkToken.provider as ProviderType, externalId, metadata);

		// Remove o token após uso
		await db.delete(linkingTokens).where(eq(linkingTokens.id, linkToken.id));

		return { userId: linkToken.userId, provider: linkToken.provider };
	}
}

export const accountLinkingService = new AccountLinkingService();
