export * from './types';
export * from './whatsapp-adapter';
export * from './telegram-adapter';

import { telegramAdapter } from './telegram-adapter';
import { whatsappAdapter } from './whatsapp-adapter';
import type { ProviderType, MessagingProvider } from './types';

export function getProvider(name: ProviderType): MessagingProvider | null {
	if (name === 'telegram') return telegramAdapter;
	if (name === 'whatsapp') return whatsappAdapter;
	return null;
}
