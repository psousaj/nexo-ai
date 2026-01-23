import api from './api';
import type { AnalyticsData, MemoryItem, ErrorReport, ConversationSummary, ItemType } from '../types';

const FIXED_USER_ID = 'a6051a80-0000-0000-0000-000000000000'; // Temporary fixed userId for testing

export const dashboardService = {
	async getAnalytics(): Promise<AnalyticsData> {
		const { data } = await api.get<AnalyticsData>('/analytics');
		return data;
	},

	async getMemories(search?: string): Promise<MemoryItem[]> {
		const { data } = await api.get<any>('/memories', {
			params: {
				userId: FIXED_USER_ID,
				search: search || undefined,
			},
		});

		// Backend retorna array direto se for busca, ou objeto se for listItems simples
		const items = Array.isArray(data) ? data : data.items || data;

		return items.map((item: any) => ({
			id: item.id,
			title: item.title,
			content: item.metadata?.full_content || item.title,
			type: item.type,
			category: item.type,
			platform: item.metadata?.platform || 'Web',
			createdAt: item.createdAt,
		}));
	},

	async createMemory(payload: { title: string; type: ItemType; content: string }): Promise<any> {
		const metadata: any = {};
		if (payload.type === 'link') metadata.url = payload.content;
		if (payload.type === 'note') metadata.full_content = payload.content;

		const { data } = await api.post('/memories', {
			userId: FIXED_USER_ID,
			type: payload.type,
			title: payload.title,
			metadata,
		});
		return data;
	},

	async updateMemory(id: string | number, payload: { title?: string; content?: string }): Promise<any> {
		const updates: any = { userId: FIXED_USER_ID };
		if (payload.title) updates.title = payload.title;
		if (payload.content) updates.metadata = { full_content: payload.content };

		const { data } = await api.patch(`/memories/${id}`, updates);
		return data;
	},

	async deleteMemory(id: string | number): Promise<void> {
		await api.delete(`/memories/${id}`, {
			params: { userId: FIXED_USER_ID },
		});
	},

	async getErrors(): Promise<ErrorReport[]> {
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

	// Preferences
	async getPreferences(): Promise<any> {
		const { data } = await api.get('/user/preferences', {
			params: { userId: FIXED_USER_ID },
		});
		return data;
	},

	async updatePreferences(updates: any): Promise<void> {
		await api.patch('/user/preferences', {
			userId: FIXED_USER_ID,
			...updates,
		});
	},

	// Account Linking
	async getAccounts(): Promise<any[]> {
		const { data } = await api.get('/user/accounts', {
			params: { userId: FIXED_USER_ID },
		});
		return data.accounts;
	},

	async linkTelegram(): Promise<{ link: string; token: string }> {
		const { data } = await api.post('/user/link/telegram', {
			userId: FIXED_USER_ID,
		});
		return data;
	},

	async linkDiscord(): Promise<{ link: string }> {
		const { data } = await api.get('/user/link/discord', {
			params: { userId: FIXED_USER_ID },
		});
		return data;
	},
};
