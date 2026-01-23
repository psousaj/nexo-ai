import api from './api';
import { mockAnalytics, mockMemories, mockErrors, mockConversations } from '../utils/mockData';
import type { AnalyticsData, MemoryItem, ErrorReport, ConversationSummary } from '../types';

const IS_MOCK = false; // Toggle this to switch between real API and mock
const FIXED_USER_ID = 'a6051a80-0000-0000-0000-000000000000'; // Temporary fixed userId for testing

export const dashboardService = {
	async getAnalytics(): Promise<AnalyticsData> {
		if (IS_MOCK) {
			await new Promise((r) => setTimeout(r, 600));
			return mockAnalytics;
		}
		const { data } = await api.get<AnalyticsData>('/analytics');
		console.log('📊 Analytics Data received:', data);
		return data;
	},

	async getMemories(): Promise<MemoryItem[]> {
		if (IS_MOCK) {
			await new Promise((r) => setTimeout(r, 400));
			return mockMemories;
		}
		// O backend retorna { items: [...] } em /api/dashboard/memories
		const { data } = await api.get<any>('/memories', {
			params: { userId: FIXED_USER_ID },
		});

		// Mapear se necessário ou extrair da prop items
		return (data.items || data).map((item: any) => ({
			id: item.id,
			title: item.title,
			content: item.title, // Backend não tem "content" separado em memoryItems por padrão ainda
			type: item.type,
			category: item.type,
			platform: 'Telegram', // Mocked platform
			createdAt: item.createdAt,
		}));
	},

	async getErrors(): Promise<ErrorReport[]> {
		if (IS_MOCK) {
			await new Promise((r) => setTimeout(r, 500));
			return mockErrors;
		}
		const { data } = await api.get<any[]>('/admin/errors');
		return data.map((err: any) => ({
			id: err.id,
			service: err.metadata?.provider || 'api',
			message: err.errorMessage,
			severity: 'high',
			status: err.resolved ? 'resolved' : 'pending',
			timestamp: err.createdAt,
		}));
	},

	async getConversations(): Promise<ConversationSummary[]> {
		if (IS_MOCK) {
			await new Promise((r) => setTimeout(r, 700));
			return mockConversations;
		}
		const { data } = await api.get<any[]>('/admin/conversations');
		return data.map((conv: any) => ({
			id: conv.id,
			userHash: conv.userHash,
			platform: 'Telegram',
			duration: '5m',
			sentiment: 'neutral',
			messageCount: conv.messages || 0,
			lastInteraction: conv.lastMessage,
			highlights: [],
		}));
	},
};
