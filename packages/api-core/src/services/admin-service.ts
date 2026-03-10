import { db } from '@/db';
import { conversations, messages, userChannels, users } from '@/db/schema';
import { instrumentService } from '@/services/service-instrumentation';
import { count, desc, eq } from 'drizzle-orm';

export class AdminService {
	/**
	 * Lista sumário de conversas anonimizadas (LGPD compliant).
	 * O channel é lido direto da coluna conversations.channel.
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
				channel: conversations.channel,
				messageCount: count(messages.id),
			})
			.from(conversations)
			.leftJoin(messages, eq(conversations.id, messages.conversationId))
			.groupBy(conversations.id)
			.orderBy(desc(conversations.updatedAt))
			.limit(limit);

		return result.map((c) => ({
			id: c.id,
			userId: c.userId,
			userHash: c.userId.substring(0, 8),
			provider: c.channel ?? 'unknown',
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
				metadata: messages.metadata,
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
						id: userChannels.id,
						provider: userChannels.channel,
						externalId: userChannels.channelUserId,
						createdAt: userChannels.linkedAt,
					})
					.from(userChannels)
					.where(eq(userChannels.userId, user.id));

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
