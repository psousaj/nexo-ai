import { db } from '@/db';
import { users, memoryItems, messages, conversations } from '@/db/schema';
import { count, sql, and, gte, eq, desc } from 'drizzle-orm';

export class AnalyticsService {
	/**
	 * Retorna KPIs principais
	 */
	async getKPIs() {
		const [totalUsers] = await db.select({ value: count() }).from(users);
		const [totalMemories] = await db.select({ value: count() }).from(memoryItems);
		const [totalMessages] = await db.select({ value: count() }).from(messages);

		// Simulação de trends (em um cenário real seria comparado com o período anterior)
		return [
			{ title: 'Total Users', value: this.formatValue(Number(totalUsers.value)), trend: 12.5, icon: 'Users' },
			{ title: 'Memórias Salvas', value: this.formatValue(Number(totalMemories.value)), trend: 8.2, icon: 'Database' },
			{ title: 'Mensagens Processadas', value: this.formatValue(Number(totalMessages.value)), trend: -2.4, icon: 'MessageSquare' },
			{ title: 'Conversas Ativas', value: '85', trend: 5.1, icon: 'Activity' },
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
		// Mock de dados para o gráfico de linha
		return {
			labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
			datasets: [
				{
					label: 'Crescimento de Usuários',
					data: [100, 150, 230, 310, 420, 560],
					color: '#6366f1',
				},
				{
					label: 'Memórias Salvas',
					data: [50, 80, 140, 210, 290, 410],
					color: '#10b981',
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
		if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
		return val.toString();
	}
}

export const analyticsService = new AnalyticsService();
