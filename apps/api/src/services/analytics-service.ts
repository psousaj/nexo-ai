import { db } from '@/db';
import { conversations, memoryItems, messages, users } from '@/db/schema';
import { instrumentService } from '@/services/service-instrumentation';
import { count, desc, eq, sql } from 'drizzle-orm';

export class AnalyticsService {
	/**
	 * Retorna KPIs principais.
	 * Se userId for passado (usuário não-admin), limita os dados ao próprio usuário.
	 */
	async getKPIs(userId?: string) {
		if (userId) {
			// Escopo por usuário
			const [totalMemories] = await db
				.select({ value: count() })
				.from(memoryItems)
				.where(eq(memoryItems.userId, userId));
			const [totalMessages] = await db
				.select({ value: count() })
				.from(messages)
				.innerJoin(conversations, eq(messages.conversationId, conversations.id))
				.where(eq(conversations.userId, userId));
			return [
				{ title: 'Memórias Salvas', value: this.formatValue(Number(totalMemories.value)), trend: 0, icon: 'Database' },
				{
					title: 'Mensagens Processadas',
					value: this.formatValue(Number(totalMessages.value)),
					trend: 0,
					icon: 'MessageSquare',
				},
			];
		}

		// Escopo global (admin)
		const [totalUsers] = await db.select({ value: count() }).from(users);
		const [totalMemories] = await db.select({ value: count() }).from(memoryItems);
		const [totalMessages] = await db.select({ value: count() }).from(messages);
		const [activeConvs] = await db
			.select({ value: count() })
			.from(conversations)
			.where(eq(conversations.isActive, true));

		return [
			{ title: 'Total Users', value: this.formatValue(Number(totalUsers.value)), trend: 12.5, icon: 'Users' },
			{ title: 'Memórias Salvas', value: this.formatValue(Number(totalMemories.value)), trend: 8.2, icon: 'Database' },
			{
				title: 'Mensagens Processadas',
				value: this.formatValue(Number(totalMessages.value)),
				trend: -2.4,
				icon: 'MessageSquare',
			},
			{ title: 'Conversas Ativas', value: this.formatValue(Number(activeConvs.value)), trend: 5.1, icon: 'Activity' },
		];
	}

	/**
	 * Retorna itens recentes (Memórias).
	 * Se userId for passado (usuário não-admin), limita ao próprio usuário.
	 */
	async getRecentItems(limit = 5, userId?: string) {
		const query = db.select().from(memoryItems);
		const result = await (userId
			? query.where(eq(memoryItems.userId, userId)).orderBy(desc(memoryItems.createdAt)).limit(limit)
			: query.orderBy(desc(memoryItems.createdAt)).limit(limit));

		return result.map((item) => ({
			id: item.id,
			title: item.title,
			content: item.title,
			type: item.type,
			category: item.type,
			platform: 'Telegram',
			createdAt: item.createdAt.toISOString(),
		}));
	}

	/**
	 * Retorna dados de tendências (últimos 6 meses).
	 * Se userId for passado, escopa apenas os dados do próprio usuário.
	 * Usa month_key (YYYY-MM string) como chave de merge para evitar problemas com Date objects.
	 */
	async getTrends(userId?: string) {
		const memoryTrends = await (userId
			? db.execute(sql`
				SELECT 
					TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month_key,
					TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as label,
					COUNT(*)::int as value
				FROM ${memoryItems}
				WHERE created_at >= NOW() - INTERVAL '6 months'
				  AND user_id = ${userId}
				GROUP BY DATE_TRUNC('month', created_at)
				ORDER BY DATE_TRUNC('month', created_at) ASC
			`)
			: db.execute(sql`
				SELECT 
					TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month_key,
					TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as label,
					COUNT(*)::int as value
				FROM ${memoryItems}
				WHERE created_at >= NOW() - INTERVAL '6 months'
				GROUP BY DATE_TRUNC('month', created_at)
				ORDER BY DATE_TRUNC('month', created_at) ASC
			`));

		const messageTrends = await (userId
			? db.execute(sql`
				SELECT 
					TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month_key,
					TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as label,
					COUNT(*)::int as value
				FROM ${messages}
				WHERE created_at >= NOW() - INTERVAL '6 months'
				  AND conversation_id IN (SELECT id FROM conversations WHERE user_id = ${userId})
				GROUP BY DATE_TRUNC('month', created_at)
				ORDER BY DATE_TRUNC('month', created_at) ASC
			`)
			: db.execute(sql`
				SELECT 
					TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month_key,
					TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as label,
					COUNT(*)::int as value
				FROM ${messages}
				WHERE created_at >= NOW() - INTERVAL '6 months'
				GROUP BY DATE_TRUNC('month', created_at)
				ORDER BY DATE_TRUNC('month', created_at) ASC
			`));

		// month_key é string 'YYYY-MM' — comparação e deduplicação por valor funciona corretamente
		const allKeys = Array.from(
			new Set([...memoryTrends.map((m) => m.month_key as string), ...messageTrends.map((m) => m.month_key as string)]),
		).sort();

		if (allKeys.length === 0) {
			return {
				labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
				datasets: [
					{ label: 'Memórias Salvas', data: [0, 0, 0, 0, 0, 0], color: '#10b981' },
					{ label: 'Mensagens Processadas', data: [0, 0, 0, 0, 0, 0], color: '#6366f1' },
				],
			};
		}

		const memoryByKey = new Map(memoryTrends.map((m) => [m.month_key as string, m.value as number]));
		const messageByKey = new Map(messageTrends.map((m) => [m.month_key as string, m.value as number]));
		// Mapeia month_key para label de exibição
		const keyToLabel = new Map([
			...memoryTrends.map((m) => [m.month_key as string, m.label as string] as const),
			...messageTrends.map((m) => [m.month_key as string, m.label as string] as const),
		]);

		return {
			labels: allKeys.map((k) => keyToLabel.get(k) ?? k),
			datasets: [
				{
					label: 'Memórias Salvas',
					data: allKeys.map((k) => memoryByKey.get(k) ?? 0),
					color: '#10b981',
				},
				{
					label: 'Mensagens Processadas',
					data: allKeys.map((k) => messageByKey.get(k) ?? 0),
					color: '#6366f1',
				},
			],
		};
	}

	/**
	 * Retorna breakdown por tipo de item.
	 * Se userId for passado, escopa apenas os dados do próprio usuário.
	 */
	async getBreakdown(userId?: string) {
		const query = db
			.select({
				type: memoryItems.type,
				count: count(),
			})
			.from(memoryItems);
		const result = await (userId
			? query.where(eq(memoryItems.userId, userId)).groupBy(memoryItems.type)
			: query.groupBy(memoryItems.type));

		return {
			labels: result.map((r) => r.type),
			data: result.map((r) => r.count),
		};
	}

	private formatValue(val: number): string {
		if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
		return val.toString();
	}
}

export const analyticsService = instrumentService('analytics', new AnalyticsService());
