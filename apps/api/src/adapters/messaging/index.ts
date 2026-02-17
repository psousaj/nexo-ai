export * from './types';
export * from './whatsapp-adapter';
export * from './telegram-adapter';
export * from './discord-adapter';

import { discordAdapter } from './discord-adapter';
import { telegramAdapter } from './telegram-adapter';
import type { MessagingProvider, ProviderType } from './types';
import { whatsappAdapter } from './whatsapp-adapter';

export function getProvider(name: ProviderType): MessagingProvider | null {
	if (name === 'telegram') return telegramAdapter;
	if (name === 'whatsapp') return whatsappAdapter;
	if (name === 'discord') return discordAdapter;
	return null;
}
