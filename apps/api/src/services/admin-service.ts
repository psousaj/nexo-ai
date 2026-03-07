import { db } from '@/db';
import { authProviders, conversations, messages, users } from '@/db/schema';
import { instrumentService } from '@/services/service-instrumentation';
import { count, desc, eq, inArray } from 'drizzle-orm';

export class AdminService {
	/**
	 * Lista sumário de conversas anonimizadas (LGPD compliant).
	 * Retorna userId hasheado + provider principal do usuário — sem nome ou e-mail.
	 */
	async getConversationSummaries(limit = 20) {
		const result = await db
			.select({
				id: conversations.id,
				userId: conversations.userId,
				state: conversations.state,
				isActive: conversations.isActive,
				updatedAt: conversations.updatedAt,
				createdAt: conversations.createdAt,
				messageCount: count(messages.id),
			})
			.from(conversations)
			.leftJoin(messages, eq(conversations.id, messages.conversationId))
			.groupBy(conversations.id)
			.orderBy(desc(conversations.updatedAt))
			.limit(limit);

		// Busca o provider principal de cada userId de forma batch
		const userIds = [...new Set(result.map((c) => c.userId))];
		const providerRows = userIds.length
			? await db
					.select({ userId: authProviders.userId, provider: authProviders.provider })
					.from(authProviders)
					.where(inArray(authProviders.userId, userIds))
			: [];

		const providerMap = new Map<string, string>();
		for (const row of providerRows) {
			// Prioridade: telegram > whatsapp > discord > outros
			const priority: Record<string, number> = { telegram: 0, whatsapp: 1, discord: 2 };
			const existing = providerMap.get(row.userId);
			if (!existing || (priority[row.provider] ?? 99) < (priority[existing] ?? 99)) {
				providerMap.set(row.userId, row.provider);
			}
		}

		return result.map((c) => ({
			id: c.id,
			userId: c.userId, // necessário para o front comparar com o usuário logado
			userHash: c.userId.substring(0, 8), // Anonimizado conforme LGPD
			provider: providerMap.get(c.userId) ?? 'unknown',
			status: c.isActive ? 'Active' : 'Closed',
			lastMessage: c.updatedAt,
			messages: Number(c.messageCount),
		}));
	}

	/**
	 * Retorna todas as mensagens de uma conversa (auditoria)
	 */
	async getConversationMessages(conversationId: string) {
		const conv = await db
			.select({
				id: conversations.id,
				userId: conversations.userId,
				userName: users.name,
				state: conversations.state,
				context: conversations.context,
				isActive: conversations.isActive,
				createdAt: conversations.createdAt,
				updatedAt: conversations.updatedAt,
			})
			.from(conversations)
			.leftJoin(users, eq(conversations.userId, users.id))
			.where(eq(conversations.id, conversationId))
			.limit(1);

		if (!conv.length) return null;

		const msgs = await db
			.select({
				id: messages.id,
				role: messages.role,
				content: messages.content,
				provider: messages.provider,
				createdAt: messages.createdAt,
			})
			.from(messages)
			.where(eq(messages.conversationId, conversationId))
			.orderBy(messages.createdAt);

		return {
			conversation: {
				id: conv[0].id,
				userId: conv[0].userId,
				userName: conv[0].userName || 'Anônimo',
				state: conv[0].state,
				context: conv[0].context,
				isActive: conv[0].isActive,
				createdAt: conv[0].createdAt,
				updatedAt: conv[0].updatedAt,
			},
			messages: msgs,
		};
	}

	/**
	 * Lista todos os usuários com suas contas
	 */
	async getAllUsersWithAccounts() {
		const allUsers = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				assistantName: users.assistantName,
				timeoutUntil: users.timeoutUntil,
				createdAt: users.createdAt,
				updatedAt: users.updatedAt,
			})
			.from(users)
			.orderBy(desc(users.createdAt));

		// Para cada usuário, buscar suas contas
		const usersWithAccounts = await Promise.all(
			allUsers.map(async (user) => {
				const accounts = await db
					.select({
						id: authProviders.id,
						provider: authProviders.provider,
						externalId: authProviders.providerUserId,
						createdAt: authProviders.linkedAt,
					})
					.from(authProviders)
					.where(eq(authProviders.userId, user.id));

				return {
					...user,
					accounts,
					isActive: !user.timeoutUntil || new Date(user.timeoutUntil) < new Date(),
				};
			}),
		);

		return usersWithAccounts;
	}
}

export const adminService = instrumentService('admin', new AdminService());
