import api from './api';
import { mockAnalytics, mockMemories, mockErrors, mockConversations } from '../utils/mockData';
import type { AnalyticsData, MemoryItem, ErrorReport, ConversationSummary } from '../types';

const IS_MOCK = true; // Toggle this to switch between real API and mock

export const dashboardService = {
	async getAnalytics(): Promise<AnalyticsData> {
		if (IS_MOCK) {
			await new Promise((r) => setTimeout(r, 600));
			return mockAnalytics;
		}
		const { data } = await api.get<AnalyticsData>('/api/analytics');
		return data;
	},

	async getMemories(): Promise<MemoryItem[]> {
		if (IS_MOCK) {
			await new Promise((r) => setTimeout(r, 400));
			return mockMemories;
		}
		const { data } = await api.get<MemoryItem[]>('/api/memories');
		return data;
	},

	async getErrors(): Promise<ErrorReport[]> {
		if (IS_MOCK) {
			await new Promise((r) => setTimeout(r, 500));
			return mockErrors;
		}
		const { data } = await api.get<ErrorReport[]>('/api/admin/errors');
		return data;
	},

	async getConversations(): Promise<ConversationSummary[]> {
		if (IS_MOCK) {
			await new Promise((r) => setTimeout(r, 700));
			return mockConversations;
		}
		const { data } = await api.get<ConversationSummary[]>('/api/admin/conversations');
		return data;
	},
};
