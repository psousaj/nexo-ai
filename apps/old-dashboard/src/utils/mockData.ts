import type { AnalyticsData, ConversationSummary, ErrorReport, MemoryItem } from '../types';

export const mockMemories: MemoryItem[] = [
	{
		id: 1,
		title: 'Oppenheimer (2023)',
		type: 'movie',
		category: 'Filmes',
		createdAt: '2026-01-21',
		content: 'Filme biográfico sobre J. Robert Oppenheimer, o físico teórico conhecido como o "pai da bomba atômica".',
		platform: 'WhatsApp',
	},
	{
		id: 2,
		title: 'Receita de Pão Italiano',
		type: 'text',
		category: 'Receitas',
		createdAt: '2026-01-22',
		content: '500g farinha, 350ml água, 10g sal, 5g fermento.',
		platform: 'Telegram',
	},
	{
		id: 3,
		title: 'Better Auth Repo',
		type: 'link',
		category: 'Dev',
		createdAt: '2026-01-23',
		content: 'https://github.com/better-auth - Modern authentication framework.',
		platform: 'Web',
	},
];

export const mockErrors: ErrorReport[] = [
	{
		id: 'ERR-001',
		service: 'MessageAnalysis',
		message: 'Token limit exceeded for GPT-4',
		timestamp: '2026-01-23T14:00:00Z',
		status: 'pending',
		severity: 'high',
	},
	{
		id: 'ERR-002',
		service: 'WhatsAppProvider',
		message: 'Connection timeout with Meta API',
		timestamp: '2026-01-23T13:45:00Z',
		status: 'resolved',
		severity: 'medium',
	},
	{
		id: 'ERR-003',
		service: 'BetterAuth',
		message: 'Invalid session signature detected',
		timestamp: '2026-01-23T12:00:00Z',
		status: 'resolved',
		severity: 'critical',
	},
];

export const mockConversations: ConversationSummary[] = [
	{
		id: 'CONV-001',
		userHash: 'user_4f9a...',
		platform: 'WhatsApp',
		duration: '12 min',
		sentiment: 'positive',
		messageCount: 14,
		lastInteraction: '2 min atrás',
		highlights: ['Buscou filme: "Oppenheimer"', 'Salvou nota: "Listar amanhã"'],
	},
	{
		id: 'CONV-002',
		userHash: 'user_bc21...',
		platform: 'Telegram',
		duration: '5 min',
		sentiment: 'negative',
		messageCount: 3,
		lastInteraction: '15 min atrás',
		highlights: ['Erro ao processar imagem', 'Bot demorou > 10s para responder'],
	},
];

export const mockAnalytics: AnalyticsData = {
	kpis: [
		{ title: 'Total de Usuários', value: '1,284', trend: 12.5, icon: 'Users' },
		{ title: 'Memórias Salvas', value: '8,432', trend: 24.8, icon: 'Database' },
		{ title: 'Mensagens Processadas', value: '42.5k', trend: 8.2, icon: 'MessageSquare' },
		{ title: 'Conversas Ativas', value: '156', trend: -3.4, icon: 'Activity' },
	],
	trends: {
		labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul'],
		datasets: [
			{
				label: 'Usuários',
				data: [400, 450, 500, 600, 800, 1000, 1284],
				color: '#3b82f6',
			},
			{
				label: 'Memórias',
				data: [1200, 2100, 3200, 4500, 5800, 7200, 8432],
				color: '#8b5cf6',
			},
		],
	},
	breakdown: {
		labels: ['Link', 'Texto', 'Imagem', 'Áudio', 'Vídeo'],
		data: [45, 25, 15, 10, 5],
	},
	recentItems: mockMemories.slice(0, 5),
};

// Combine all into a single export for the "dashboard" mock
export const mockDashboardData = {
	...mockAnalytics,
	recentItems: mockMemories.slice(0, 5),
};
