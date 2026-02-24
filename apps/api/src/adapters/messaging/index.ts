export * from './types';
export * from './whatsapp-adapter';
export * from './telegram-adapter';
export * from './discord-adapter';

import { db } from '@/db';
import { whatsappSettings } from '@/db/schema';
import { loggers } from '@/utils/logger';
import { discordAdapter } from './discord-adapter';
import { telegramAdapter } from './telegram-adapter';
import type { MessagingProvider, ProviderType } from './types';
import { whatsappAdapter } from './whatsapp-adapter';

/**
 * Cache da API ativa do WhatsApp
 * Evita consultas ao banco a cada chamada
 */
let cachedApiType: 'meta' | 'baileys' | null = null;
let cachedWhatsAppProvider: MessagingProvider | null = null;

/**
 * Invalida o cache do provider WhatsApp
 * Deve ser chamado quando a API é alterada no dashboard
 */
export function invalidateWhatsAppProviderCache(): void {
	cachedApiType = null;
	cachedWhatsAppProvider = null;
	loggers.ai.info('🔄 Cache do provider WhatsApp invalidado');
}

/**
 * Obtém a API ativa do WhatsApp do banco de dados
 * Usa cache para evitar consultas repetidas
 */
async function getActiveWhatsAppApi(): Promise<'meta' | 'baileys'> {
	if (cachedApiType) {
		return cachedApiType;
	}

	try {
		const [settings] = await db.select().from(whatsappSettings).limit(1);

		cachedApiType = settings?.activeApi || 'meta';

		loggers.ai.info({ activeApi: cachedApiType }, '📱 API WhatsApp ativa definida');

		return cachedApiType;
	} catch (error) {
		loggers.ai.error({ error }, '❌ Erro ao buscar API WhatsApp ativa');
		return 'meta'; // Padrão para Meta API em caso de erro
	}
}

/**
 * Provider factory - Retorna o adapter baseado no nome do provider
 * Para WhatsApp, lê a API ativa do banco de dados
 */
export async function getProvider(name: ProviderType): Promise<MessagingProvider | null> {
	if (name === 'telegram') return telegramAdapter;
	if (name === 'discord') return discordAdapter;

	if (name === 'whatsapp') {
		// Usar cache se disponível
		if (cachedWhatsAppProvider) {
			return cachedWhatsAppProvider;
		}

		const activeApi = await getActiveWhatsAppApi();

		if (activeApi === 'baileys') {
			// Lazy load do adapter Baileys
			const { createBaileysAdapter } = await import('./baileys-adapter');
			cachedWhatsAppProvider = createBaileysAdapter();
			loggers.ai.info('📱 Provider Baileys carregado');
		} else {
			// Meta API (padrão)
			cachedWhatsAppProvider = whatsappAdapter;
			loggers.ai.info('📱 Provider Meta API carregado');
		}

		return cachedWhatsAppProvider;
	}

	return null;
}

/**
 * Define a API ativa do WhatsApp (para o dashboard admin)
 * @param api - 'meta' ou 'baileys'
 */
export async function setActiveWhatsAppApi(api: 'meta' | 'baileys'): Promise<void> {
	// Atualizar no banco
	await db
		.insert(whatsappSettings)
		.values({
			id: 'global',
			activeApi: api,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: whatsappSettings.id,
			set: {
				activeApi: api,
				updatedAt: new Date(),
			},
		});

	// Invalidar cache
	invalidateWhatsAppProviderCache();

	loggers.ai.info({ api }, '✅ API WhatsApp alterada com sucesso');
}

/**
 * Obtém configurações atuais do WhatsApp
 * Cria registro padrão se não existir
 */
export async function getWhatsAppSettings() {
	let [settings] = await db.select().from(whatsappSettings).limit(1);

	// Se não existe, criar registro padrão
	if (!settings) {
		loggers.ai.info('📱 Criando configurações padrão do WhatsApp');
		[settings] = await db
			.insert(whatsappSettings)
			.values({
				id: 'global',
				activeApi: 'meta',
			})
			.returning();
	}

	return settings;
}

// Export síncrono para backward compatibility
// Nota: Para WhatsApp, use getProvider() async para garantir API correta
export function getProviderSync(name: ProviderType): MessagingProvider | null {
	if (name === 'telegram') return telegramAdapter;
	if (name === 'whatsapp') return whatsappAdapter; // Fallback para Meta API
	if (name === 'discord') return discordAdapter;
	return null;
}
