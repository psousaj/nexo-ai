export type UserRole = 'admin' | 'user';

export interface ToolDefinition {
	name: string;
	label: string;
	description: string;
	icon: string;
	category: 'system' | 'user';
}
export type ItemType = 'movie' | 'tv_show' | 'video' | 'link' | 'note' | 'memo' | 'book' | 'music' | 'image';

export interface User {
	id: string;
	name: string;
	email: string;
	image?: string;
	role: UserRole;
}

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
