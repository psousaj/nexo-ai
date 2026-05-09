import { Bot } from 'grammy';
import type { TelegramConfig } from './types';

let botInstance: Bot | null = null;

export function getBot(): Bot {
	if (!botInstance) throw new Error('Telegram bot not initialized. Call initBot() first.');
	return botInstance;
}

export function initBot(config: TelegramConfig): Bot {
	const bot = new Bot(config.botToken);
	if (config.webhookUrl) {
		bot.api.setWebhook(config.webhookUrl).catch(console.error);
	}
	botInstance = bot;
	return bot;
}
