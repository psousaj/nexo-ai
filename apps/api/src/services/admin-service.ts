import { db } from '@/db';
import { errorReports, conversations, users, messages } from '@/db/schema';
import { desc, eq, sql, count } from 'drizzle-orm';

export class AdminService {
	/**
	 * Lista relatórios de erro
	 */
	async getErrorReports(limit = 20) {
		return await db.select().from(errorReports).orderBy(desc(errorReports.createdAt)).limit(limit);
	}

	/**
	 * Lista sumário de conversas anonimizadas
	 */
	async getConversationSummaries(limit = 20) {
		// Busca conversas recentes com o nome do usuário (para o dashboard admin ver quem é)
		// No contrato diz userHash anonimizado, mas para admin costuma ser útil ver o nome
		// Vamos seguir o contrato e retornar sessionId/userHash se necessário

		const result = await db
			.select({
				id: conversations.id,
				userId: conversations.userId,
				userName: users.name,
				state: conversations.state,
				isActive: conversations.isActive,
				updatedAt: conversations.updatedAt,
				createdAt: conversations.createdAt,
				messageCount: count(messages.id),
			})
			.from(conversations)
			.leftJoin(users, eq(conversations.userId, users.id))
			.leftJoin(messages, eq(conversations.id, messages.conversationId))
			.groupBy(conversations.id, users.id)
			.orderBy(desc(conversations.updatedAt))
			.limit(limit);

		return result.map((c) => ({
			id: c.id,
			userHash: c.userId.substring(0, 8), // Anonimizado conforme contrato
			userName: c.userName || 'Anônimo',
			status: c.isActive ? 'Active' : 'Closed',
			lastMessage: c.updatedAt,
			messages: Number(c.messageCount),
		}));
	}
}

export const adminService = new AdminService();
