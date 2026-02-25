import type {
	Account,
	AnalyticsData,
	ConversationSummary,
	ItemType,
	MemoryItem,
	UserPreferences,
} from '~/types/dashboard';
import api from '~/utils/api';

export const useDashboard = () => {
	const getAnalytics = async (): Promise<AnalyticsData> => {
		const { data } = await api.get<AnalyticsData>('/analytics');
		return data;
	};

	const getMemories = async (search?: string): Promise<MemoryItem[]> => {
		const { data } = await api.get<{ items?: any[]; data?: any[] } | any[]>('/memories', {
			params: {
				search: search || undefined,
			},
		});

		const items = Array.isArray(data) ? data : (data as any).items || (data as any).data || data;

		return (items as any[]).map((item: any) => ({
			id: item.id,
			title: item.title,
			content: item.metadata?.full_content || item.title,
			type: item.type as ItemType,
			category: item.type,
			platform: item.metadata?.platform || 'Web',
			createdAt: item.createdAt,
		}));
	};

	const createMemory = async (payload: { title: string; type: ItemType; content: string }): Promise<any> => {
		const metadata: any = {};
		if (payload.type === 'link') metadata.url = payload.content;
		if (payload.type === 'note' || payload.type === 'text') {
			metadata.full_content = payload.content;
		}

		const { data } = await api.post('/memories', {
			type: payload.type,
			title: payload.title,
			metadata,
		});
		return data;
	};

	const updateMemory = async (
		id: string | number,
		payload: { title?: string; content?: string },
	): Promise<{ success: boolean }> => {
		const updates: Record<string, any> = {};
		if (payload.title) updates.title = payload.title;
		if (payload.content) updates.metadata = { full_content: payload.content };

		const { data } = await api.patch<{ success: boolean }>(`/memories/${id}`, updates);
		return data;
	};

	const deleteMemory = async (id: string | number): Promise<void> => {
		await api.delete(`/memories/${id}`);
	};

	const getConversations = async (): Promise<ConversationSummary[]> => {
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
	};

	const getPreferences = async (): Promise<UserPreferences> => {
		const { data } = await api.get<UserPreferences>('/user/preferences');
		return data;
	};

	const updatePreferences = async (updates: Partial<UserPreferences>): Promise<void> => {
		await api.patch('/user/preferences', updates);
	};

	const getAccounts = async (): Promise<Account[]> => {
		const { data } = await api.get<{ accounts: Account[] }>('/user/accounts');
		return data.accounts || [];
	};

	const syncAccounts = async (): Promise<{
		success: boolean;
		message: string;
		synced: number;
		skipped: number;
	}> => {
		const { data } = await api.post('/user/accounts/sync');
		return data;
	};

	const linkTelegram = async (): Promise<{ link: string; vinculateCode: string }> => {
		const { data } = await api.post('/user/link/telegram');
		return data;
	};

	const linkDiscord = async (): Promise<{ link: string }> => {
		const { data } = await api.get('/user/link/discord');
		return data;
	};

	const linkGoogle = async (): Promise<{ link: string }> => {
		const { data } = await api.get('/user/link/google');
		return data;
	};

	const consumeLinkingToken = async (vinculateCode: string): Promise<void> => {
		await api.post('/user/link/consume', { vinculateCode });
	};

	const unlinkAccount = async (provider: string): Promise<void> => {
		await api.delete(`/user/accounts/${provider}`);
	};

	// WhatsApp Settings
	const getWhatsAppSettings = async (): Promise<{
		id: string;
		activeApi: 'meta' | 'baileys';
		baileysPhoneNumber?: string;
		metaPhoneNumberId?: string;
		baileysConnectionStatus?: string;
		lastError?: string;
		updatedAt: string;
		createdAt: string;
	}> => {
		const { data } = await api.get('/admin/whatsapp-settings');
		return data;
	};

	const setWhatsAppApi = async (whatsappApi: 'meta' | 'baileys'): Promise<{ success: boolean; activeApi: string }> => {
		const { data } = await api.post('/admin/whatsapp-settings/api', { api: whatsappApi });
		return data;
	};

	const clearWhatsAppCache = async (): Promise<{ success: boolean; message: string }> => {
		const { data } = await api.post('/admin/whatsapp-settings/cache/clear');
		return data;
	};

	const getWhatsAppQRCode = async (): Promise<{ qrCode: string | null; connectionStatus?: any }> => {
		const { data } = await api.get('/admin/whatsapp-settings/qr-code');
		return data;
	};

	const disconnectBaileys = async (): Promise<any> => {
		const { data } = await api.post('/admin/whatsapp-settings/baileys/disconnect');
		return data;
	};

	const restartBaileys = async (): Promise<any> => {
		const { data } = await api.post('/admin/whatsapp-settings/baileys/restart');
		return data;
	};

	// Discord Bot Info
	const getDiscordBotInfo = async (): Promise<{
		clientId: string;
		botTokenConfigured: boolean;
		installUrl: string | null;
		permissions: string;
		scopes: string[];
		botUsername: string;
	}> => {
		const { data } = await api.get('/user/discord-bot-info');
		return data;
	};

	return {
		getAnalytics,
		getMemories,
		createMemory,
		updateMemory,
		deleteMemory,
		getConversations,
		getPreferences,
		updatePreferences,
		getAccounts,
		syncAccounts,
		linkTelegram,
		linkDiscord,
		linkGoogle,
		consumeLinkingToken,
		unlinkAccount,
		getWhatsAppSettings,
		setWhatsAppApi,
		clearWhatsAppCache,
		getWhatsAppQRCode,
		disconnectBaileys,
		restartBaileys,
		getDiscordBotInfo,
	};
};
