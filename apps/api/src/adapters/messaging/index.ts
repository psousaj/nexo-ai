export * from './types';
export * from './whatsapp-adapter';
export * from './telegram-adapter';
export * from './discord-adapter';

import { telegramAdapter } from './telegram-adapter';
import { whatsappAdapter } from './whatsapp-adapter';
import { discordAdapter } from './discord-adapter';
import type { ProviderType, MessagingProvider } from './types';

export function getProvider(name: ProviderType): MessagingProvider | null {
	if (name === 'telegram') return telegramAdapter;
	if (name === 'whatsapp') return whatsappAdapter;
	if (name === 'discord') return discordAdapter;
	return null;
}
