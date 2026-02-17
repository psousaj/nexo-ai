import type { ProviderType } from '@/adapters/messaging';
import { db } from '@/db';
import { linkingTokens } from '@/db/schema';
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
		tokenType: 'link' | 'signup' = 'link',
		externalId?: string,
	): Promise<string> {
		// Gera um token aleatório de 12 caracteres (base64url safe)
		const token =
			Math.random().toString(36).substring(2, 10).toUpperCase() +
			Math.random().toString(36).substring(2, 6).toUpperCase();

		const expiresAt = new Date();
		if (tokenType === 'signup') {
			expiresAt.setHours(expiresAt.getHours() + 24);
		} else {
			expiresAt.setMinutes(expiresAt.getMinutes() + 10);
		}

		// Remove tokens antigos/expirados do mesmo user/provider/type para limpar
		await db
			.delete(linkingTokens)
			.where(
				and(
					eq(linkingTokens.userId, userId),
					provider ? eq(linkingTokens.provider, provider) : (undefined as any),
					eq(linkingTokens.tokenType, tokenType),
				),
			);

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
	): Promise<{ userId: string; provider: string } | null> {
		const [linkToken] = await db
			.select()
			.from(linkingTokens)
			.where(and(eq(linkingTokens.token, token), gte(linkingTokens.expiresAt, new Date())))
			.limit(1);

		if (!linkToken || !linkToken.provider) return null;

		// Vincula a conta no UserService
		await userService.linkAccountToUser(linkToken.userId, linkToken.provider as ProviderType, externalId, metadata);

		// Remove o token após uso
		await db.delete(linkingTokens).where(eq(linkingTokens.id, linkToken.id));

		return { userId: linkToken.userId, provider: linkToken.provider };
	}

	/**
	 * Fluxo 2: Bot -> Dashboard (Manual Code)
	 * O usuário está no Bot, digita /vincular, recebe um token (que contém seu externalId).
	 * Ele digita o token no Dashboard (onde é o targetUserId).
	 * Vinculamos a conta associada ao token ao targetUserId.
	 */
	async linkTokenAccountToUser(
		token: string,
		targetUserId: string,
	): Promise<{ userId: string; provider: string } | null> {
		const [linkToken] = await db
			.select()
			.from(linkingTokens)
			.where(and(eq(linkingTokens.token, token), gte(linkingTokens.expiresAt, new Date())))
			.limit(1);

		if (!linkToken || !linkToken.provider) return null;

		// Buscamos as contas do userId do token (usuário temporário do Bot)
		const accounts = await userService.getUserAccounts(linkToken.userId);
		const accountToLink = accounts.find((a: any) => a.provider === linkToken.provider);

		if (!accountToLink) return null;

		// Vincula a conta ao targetUserId (Usuário do Dashboard)
		await userService.linkAccountToUser(
			targetUserId,
			accountToLink.provider as ProviderType,
			accountToLink.externalId,
			accountToLink.metadata,
		);

		// Remove o token após uso
		await db.delete(linkingTokens).where(eq(linkingTokens.id, linkToken.id));

		return { userId: targetUserId, provider: linkToken.provider };
	}
}

export const accountLinkingService = new AccountLinkingService();
