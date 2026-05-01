import type { ProviderType } from '@/adapters/messaging';
import { cacheDelete, cacheGet, cacheSet } from '@/config/redis';
import { db } from '@/db';
import { userChannels, users } from '@/db/schema';
import { accounts as betterAuthAccounts } from '@/db/schema/auth';
import { instrumentService } from '@/services/service-instrumentation';
import { loggers } from '@/utils/logger';
import { and, eq, sql } from 'drizzle-orm';

export class UserService {
	private async findChannelAccount(channel: ProviderType, externalId: string) {
		try {
			const [account] = await db
				.select()
				.from(userChannels)
				.where(and(sql`${userChannels.channel}::text = ${channel}`, eq(userChannels.channelUserId, externalId)))
				.limit(1);

			return account;
		} catch (error) {
			loggers.webhook.warn(
				{ err: error, channel, externalId },
				'⚠️ Falha no lookup canônico por channel+externalId. Tentando fallback por channel_user_id.',
			);

			try {
				const fallbackResult = await db.execute(sql`
					SELECT id, user_id, channel, channel_user_id, channel_email, linked_at, is_active, metadata, created_at, updated_at
					FROM user_channels
					WHERE channel_user_id = ${externalId}
					LIMIT 1
				`);

				const row = (fallbackResult as any)?.[0] || (fallbackResult as any)?.rows?.[0];
				if (!row) return undefined;

				if (String(row.channel) !== channel) {
					return undefined;
				}

				return {
					id: row.id,
					userId: row.user_id,
					channel: row.channel,
					channelUserId: row.channel_user_id,
					channelEmail: row.channel_email,
					linkedAt: row.linked_at,
					isActive: row.is_active,
					metadata: row.metadata,
					createdAt: row.created_at,
					updatedAt: row.updated_at,
				} as typeof userChannels.$inferSelect;
			} catch (fallbackError) {
				loggers.webhook.error(
					{ err: fallbackError, channel, externalId },
					'❌ Falha no fallback de lookup em user_channels. Seguindo sem vínculo para permitir criação trial.',
				);
				return undefined;
			}
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

		// 1b. Busca canal canônico em user_channels
		const existingChannel = await this.findChannelAccount(provider, externalId);

		if (existingChannel) {
			const user = await this.getUserById(existingChannel.userId);

			if (!user) {
				await db.delete(userChannels).where(eq(userChannels.id, existingChannel.id));
				await cacheDelete(cacheKey);
				loggers.webhook.warn(
					{ provider, externalId, danglingUserId: existingChannel.userId },
					'⚠️ user_channel órfão detectado (user inexistente). Vínculo removido para recriação.',
				);
			} else {
				const result = {
					user,
					account: {
						id: existingChannel.id,
						userId: existingChannel.userId,
						provider: existingChannel.channel as ProviderType,
						externalId: existingChannel.channelUserId,
						metadata: this.parseMetadata(existingChannel.metadata),
						providerEmail: existingChannel.channelEmail,
						linkedAt: existingChannel.linkedAt,
					},
				};

				await cacheSet(cacheKey, result, 3600);
				return result;
			}
		}

		const [newUser] = await db
			.insert(users)
			.values({
				id: crypto.randomUUID(),
				name,
				status: provider === 'whatsapp' ? 'trial' : 'pending_signup',
			})
			.returning();
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

		let newChannel: typeof userChannels.$inferSelect | null = null;
		try {
			const [created] = await db
				.insert(userChannels)
				.values({
					userId,
					channel: provider as any,
					channelUserId: externalId,
					channelEmail: undefined,
					metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : undefined,
					linkedAt: new Date(),
					updatedAt: new Date(),
				})
				.returning();
			newChannel = created;
		} catch (insertError) {
			if (provider !== 'whatsapp') {
				throw insertError;
			}

			loggers.webhook.error(
				{ err: insertError, userId, provider, externalId },
				'⚠️ Falha ao persistir user_channel de WhatsApp. Continuando em modo degradado para manter trial funcionando.',
			);
		}

		const user = await this.getUserById(userId);
		const result = {
			user,
			account: {
				id: newChannel?.id || '',
				userId: newChannel?.userId || userId,
				provider: (newChannel?.channel || provider) as ProviderType,
				externalId: newChannel?.channelUserId || externalId,
				metadata,
				providerEmail: newChannel?.channelEmail,
				linkedAt: newChannel?.linkedAt,
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
	 * Vincula um canal de mensagens a um usuário existente
	 */
	async linkAccountToUser(userId: string, provider: ProviderType, externalId: string, metadata?: any) {
		const cacheKey = this.getAccountCacheKey(provider, externalId);

		// 1. Verifica vínculo canônico em user_channels
		const existing = await this.findChannelAccount(provider, externalId);

		if (existing) {
			if (existing.userId === userId) {
				// Já está vinculado ao usuário correto, apenas atualiza metadata se necessário
				if (metadata) {
					await db
						.update(userChannels)
						.set({
							metadata: JSON.stringify({ ...this.parseMetadata(existing.metadata), ...metadata }),
							updatedAt: new Date(),
						})
						.where(eq(userChannels.id, existing.id));

					await cacheDelete(cacheKey);
				}
				loggers.webhook.info({ userId, provider, externalId }, '✅ Canal já vinculado ao usuário correto');
				return existing;
			}

			loggers.webhook.warn(
				{ existingUserId: existing.userId, targetUserId: userId, provider, externalId },
				'⚠️ Canal já vinculado a outro usuário - mantendo vínculo original',
			);

			return {
				id: existing.id,
				userId: existing.userId,
				provider: existing.channel as ProviderType,
				externalId: existing.channelUserId,
				metadata: this.parseMetadata(existing.metadata),
			};
		}

		// 2. Não existe — cria novo vínculo
		const [newChannel] = await db
			.insert(userChannels)
			.values({
				userId,
				channel: provider as any,
				channelUserId: externalId,
				metadata: metadata ? JSON.stringify(metadata) : undefined,
				linkedAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		loggers.webhook.info({ userId, provider, externalId }, '✅ Canal vinculado');
		await cacheDelete(cacheKey);

		return {
			id: newChannel.id,
			userId: newChannel.userId,
			provider: newChannel.channel as ProviderType,
			externalId: newChannel.channelUserId,
			metadata,
		};
	}

	/**
	 * Lista todas as contas vinculadas a um usuário.
	 * Retorna array unificado com discriminante `type`:
	 * - `type: 'channel'` → canais de mensagem (Telegram, WhatsApp, Discord bot) via user_channels
	 * - `type: 'oauth'` → providers OAuth (Google, Microsoft, Discord login) via BA accounts
	 */
	async getUserAccounts(userId: string) {
		const [channels, oauthAccounts] = await Promise.all([
			db.select().from(userChannels).where(eq(userChannels.userId, userId)),
			db.select().from(betterAuthAccounts).where(eq(betterAuthAccounts.userId, userId)),
		]);

		const channelEntries = channels.map((c) => ({
			type: 'channel' as const,
			id: c.id,
			userId: c.userId,
			provider: c.channel as ProviderType,
			externalId: c.channelUserId,
			metadata: this.parseMetadata(c.metadata),
			providerEmail: c.channelEmail,
			linkedAt: c.linkedAt,
		}));

		const oauthEntries = oauthAccounts
			// 'credential' é email/senha nativo do BA — não é um OAuth provider
			.filter((a) => a.providerId !== 'credential')
			.map((a) => ({
				type: 'oauth' as const,
				id: a.id,
				userId: a.userId,
				provider: a.providerId as ProviderType,
				externalId: a.accountId,
				metadata: {} as Record<string, any>,
				providerEmail: null as string | null,
				linkedAt: a.createdAt,
			}));

		return [...channelEntries, ...oauthEntries];
	}

	/**
	 * Busca um canal de mensagens por provider e ID externo
	 */
	async findAccount(provider: ProviderType, externalId: string) {
		const account = await this.findChannelAccount(provider, externalId);

		if (!account) return null;

		return {
			id: account.id,
			userId: account.userId,
			provider: account.channel as ProviderType,
			externalId: account.channelUserId,
			metadata: this.parseMetadata(account.metadata),
			providerEmail: account.channelEmail,
			linkedAt: account.linkedAt,
		};
	}

	/**
	 * Busca userId a partir de uma conta OAuth (Better Auth accounts table).
	 * Útil para auto-vincular canal de bot quando o usuário já fez OAuth no Dashboard.
	 */
	async findUserIdByOAuthAccount(provider: string, accountId: string): Promise<string | null> {
		const [row] = await db
			.select({ userId: betterAuthAccounts.userId })
			.from(betterAuthAccounts)
			.where(and(eq(betterAuthAccounts.providerId, provider), eq(betterAuthAccounts.accountId, accountId)))
			.limit(1);
		return row?.userId ?? null;
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
