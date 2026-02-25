import { db } from '@/db';
import { instrumentService } from '@/services/service-instrumentation';
import { conversations, memoryItems, messages, users } from '@/db/schema';
import { count, desc, eq, sql } from 'drizzle-orm';

export class AnalyticsService {
	/**
	 * Retorna KPIs principais
	 */
	async getKPIs() {
		const [totalUsers] = await db.select({ value: count() }).from(users);
		const [totalMemories] = await db.select({ value: count() }).from(memoryItems);
		const [totalMessages] = await db.select({ value: count() }).from(messages);
		const [activeConvs] = await db.select({ value: count() }).from(conversations).where(eq(conversations.isActive, true));

		// Simulação de trends (em um cenário real seria comparado com o período anterior)
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
	 * Retorna itens recentes (Memórias)
	 */
	async getRecentItems(limit = 5) {
		const result = await db.select().from(memoryItems).orderBy(desc(memoryItems.createdAt)).limit(limit);

		return result.map((item) => ({
			id: item.id,
			title: item.title,
			content: item.title, // Placeholder
			type: item.type,
			category: item.type,
			platform: 'Telegram', // Mocked platform
			createdAt: item.createdAt.toISOString(),
		}));
	}

	/**
	 * Retorna dados de tendências (últimos 6 meses)
	 */
	async getTrends() {
		const _months = 6;

		// Query para buscar contagem agrupadada por mês para memórias
		const memoryTrends = await db.execute(sql`
			SELECT 
				TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as label,
				DATE_TRUNC('month', created_at) as month_date,
				COUNT(*)::int as value
			FROM ${memoryItems}
			WHERE created_at >= NOW() - INTERVAL '6 months'
			GROUP BY month_date
			ORDER BY month_date ASC
		`);

		// Query para buscar contagem agrupada por mês para mensagens
		const messageTrends = await db.execute(sql`
			SELECT 
				TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as label,
				DATE_TRUNC('month', created_at) as month_date,
				COUNT(*)::int as value
			FROM ${messages}
			WHERE created_at >= NOW() - INTERVAL '6 months'
			GROUP BY month_date
			ORDER BY month_date ASC
		`);

		// Se não houver dados, retorna labels dos meses e zeros
		if (memoryTrends.length === 0 && messageTrends.length === 0) {
			return {
				labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
				datasets: [
					{ label: 'Memórias Salvas', data: [0, 0, 0, 0, 0, 0], color: '#10b981' },
					{ label: 'Mensagens Processadas', data: [0, 0, 0, 0, 0, 0], color: '#6366f1' },
				],
			};
		}

		return {
			labels: memoryTrends.map((m) => m.label as string),
			datasets: [
				{
					label: 'Memórias Salvas',
					data: memoryTrends.map((m) => m.value as number),
					color: '#10b981',
				},
				{
					label: 'Mensagens Processadas',
					data: messageTrends.map((m) => m.value as number),
					color: '#6366f1',
				},
			],
		};
	}

	/**
	 * Retorna breakdown por tipo de item
	 */
	async getBreakdown() {
		const result = await db
			.select({
				type: memoryItems.type,
				count: count(),
			})
			.from(memoryItems)
			.groupBy(memoryItems.type);

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
