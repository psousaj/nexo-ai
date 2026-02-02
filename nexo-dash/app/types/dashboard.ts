export type UserRole = 'admin' | 'user';
export type ItemType = 'movie' | 'tv_show' | 'video' | 'link' | 'note' | 'text' | 'image' | 'audio';

export interface KPIMetric {
	title: string;
	value: string | number;
	trend: number;
	icon: string;
	suffix?: string;
}

export interface AnalyticsData {
	kpis: KPIMetric[];
	trends: {
		labels: string[];
		datasets: {
			label: string;
			data: number[];
			color: string;
		}[];
	};
	breakdown: {
		labels: string[];
		data: number[];
	};
	recentItems: MemoryItem[];
}

export interface MemoryItem {
	id: string | number;
	title: string;
	content: string;
	type: ItemType;
	category: string;
	platform: 'WhatsApp' | 'Telegram' | 'Discord' | 'Web';
	createdAt: string;
}

export interface ErrorReport {
	id: string;
	service: string;
	message: string;
	severity: 'low' | 'medium' | 'high' | 'critical';
	status: 'pending' | 'resolved';
	timestamp: string;
}

export interface ConversationSummary {
	id: string;
	userHash: string;
	platform: string;
	duration: string;
	sentiment: 'positive' | 'neutral' | 'negative';
	messageCount: number;
	lastInteraction: string;
	highlights: string[];
}

export interface Account {
	userId: string;
	provider: string;
	providerAccountId: string;
	metadata?: {
		phone?: string;
		username?: string;
		email?: string;
		[key: string]: any;
	};
}

export interface UserPreferences {
	assistantName: string;
	notificationsBrowser: boolean;
	notificationsWhatsapp: boolean;
	notificationsEmail: boolean;
	privacyShowMemoriesInSearch: boolean;
	privacyShareAnalytics: boolean;
	appearanceTheme: 'light' | 'dark';
	appearanceLanguage: string;
}
