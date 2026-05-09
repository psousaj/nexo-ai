export interface TelegramConfig {
	botToken: string;
	webhookUrl?: string;
}

export interface TelegramMessage {
	chatId: number;
	text: string;
	messageId: number;
	timestamp: Date;
	messageType: 'text' | 'voice' | 'photo' | 'document';
}
