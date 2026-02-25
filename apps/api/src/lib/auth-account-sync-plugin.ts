import { db } from '@/db';
import * as schema from '@/db/schema';
import type { AuthProvider } from '@/db/schema';
import { loggers } from '@/utils/logger';
import { and, eq } from 'drizzle-orm';

const AUTH_PROVIDER_SET = new Set<AuthProvider>(schema.authProviderEnum.enumValues as AuthProvider[]);

export function toAuthProvider(provider: string): AuthProvider | null {
	return AUTH_PROVIDER_SET.has(provider as AuthProvider) ? (provider as AuthProvider) : null;
}

/**
 * Busca usuário existente por email (para vincular OAuth ao invés de duplicar)
 */
export async function findUserByEmail(email: string) {
	try {
		// 1. Busca direto na tabela users do Better Auth
		const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);

		if (user) {
			loggers.webhook.info({ userId: user.id, email }, '🔍 [Pre-check] Usuário existente encontrado');
			return user;
		}

		// 2. Fallback: busca em user_emails (caso email secundário)
		const [userEmail] = await db.select().from(schema.userEmails).where(eq(schema.userEmails.email, email)).limit(1);

		if (userEmail) {
			const [linkedUser] = await db.select().from(schema.users).where(eq(schema.users.id, userEmail.userId)).limit(1);

			if (linkedUser) {
				loggers.webhook.info({ userId: linkedUser.id, email }, '🔍 [Pre-check] Usuário existente encontrado via email secundário');
				return linkedUser;
			}
		}

		loggers.webhook.info({ email }, '🔍 [Pre-check] Nenhum usuário existente com esse email');
		return null;
	} catch (error) {
		loggers.webhook.error({ error, email }, '❌ Erro ao buscar usuário por email');
		return null;
	}
}

/**
 * Vincula OAuth account a usuário existente (evita duplicação)
 */
export async function linkOAuthToExistingUser(params: {
	existingUserId: string;
	provider: AuthProvider;
	externalId: string;
	email: string;
}) {
	const { existingUserId, provider, externalId, email } = params;

	try {
		loggers.webhook.info({ existingUserId, provider, email }, '🔗 [Link] Vinculando OAuth a usuário existente');

		// 1. Cria account no Better Auth
		// Gera ID único para o account (padrão Better Auth)
		const accountId = `${existingUserId}_${provider}_${Date.now()}`;

		await db.insert(schema.accounts).values({
			id: accountId,
			userId: existingUserId,
			providerId: provider,
			accountId: externalId,
			accessToken: null,
			refreshToken: null,
			idToken: null,
			accessTokenExpiresAt: null,
			refreshTokenExpiresAt: null,
			scope: null,
			password: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		loggers.webhook.info({ existingUserId, provider }, '✅ OAuth account vinculado a usuário existente');

		// 2. Sincroniza normalmente
		await syncOAuthAccount({
			userId: existingUserId,
			provider,
			externalId,
			email,
		});

		return { success: true, userId: existingUserId };
	} catch (error) {
		loggers.webhook.error({ error, existingUserId, provider }, '❌ Erro ao vincular OAuth');
		return { success: false, error };
	}
}

/**
 * Serviço para sincronizar Better Auth accounts com auth_providers e user_emails
 *
 * Solução alternativa aos hooks bugados do Better Auth 1.4.17
 * Chamado manualmente após OAuth callback
 */
export async function syncOAuthAccount(params: {
	userId: string;
	provider: AuthProvider;
	externalId: string;
	email?: string;
	metadata?: Record<string, any>;
}) {
	const { userId, provider, externalId, email, metadata = {} } = params;

	try {
		loggers.webhook.info({ userId, provider, externalId, email }, '🔗 [Sync] Sincronizando OAuth account');

		// 1. Sincronizar com auth_providers (canônico para identidade)
		const [existingAccount] = await db
			.select()
			.from(schema.authProviders)
			.where(and(eq(schema.authProviders.provider, provider), eq(schema.authProviders.providerUserId, externalId)))
			.limit(1);

		if (!existingAccount) {
			await db.insert(schema.authProviders).values({
				userId,
				provider,
				providerUserId: externalId,
				providerEmail: email || null,
				metadata: JSON.stringify(metadata || {}),
				linkedAt: new Date(),
				updatedAt: new Date(),
			});

			loggers.webhook.info({ userId, provider, metadata }, '✅ auth_provider criado via OAuth');
		} else {
			// Atualizar metadata se já existe
			await db
				.update(schema.authProviders)
				.set({
					metadata: JSON.stringify(metadata || {}),
					providerEmail: email || null,
					updatedAt: new Date(),
				})
				.where(and(eq(schema.authProviders.provider, provider), eq(schema.authProviders.providerUserId, externalId)));

			loggers.webhook.info({ userId, provider, metadata }, '✅ auth_provider atualizado com metadata');
		}

		// 2. Sincronizar email com user_emails (se fornecido pelo provider)
		if (email) {
			const [existingEmail] = await db.select().from(schema.userEmails).where(eq(schema.userEmails.email, email)).limit(1);

			if (!existingEmail) {
				// Verifica se usuário já tem email primário
				const [primaryEmail] = await db
					.select()
					.from(schema.userEmails)
					.where(and(eq(schema.userEmails.userId, userId), eq(schema.userEmails.isPrimary, true)))
					.limit(1);

				await db.insert(schema.userEmails).values({
					userId,
					email,
					isPrimary: !primaryEmail, // Se não tem primário, esse será
					provider,
					verified: true, // OAuth emails são pré-verificados
				});

				loggers.webhook.info({ userId, email, provider }, '✅ Email adicionado via OAuth');
			} else if (existingEmail.userId !== userId) {
				loggers.webhook.warn(
					{
						existingUserId: existingEmail.userId,
						newUserId: userId,
						email,
						provider,
					},
					'⚠️ Email já pertence a outro usuário - OAuth pode ter criado usuário duplicado',
				);
			}
		}

		return { success: true };
	} catch (error) {
		loggers.webhook.error({ error, userId, provider }, '❌ Erro ao sincronizar OAuth account');
		return { success: false, error };
	}
}
