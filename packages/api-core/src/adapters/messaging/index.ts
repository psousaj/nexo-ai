export * from './types';
export * from './evolution-adapter';
export * from './whatsapp-adapter';
export * from './telegram-adapter';
export * from './discord-adapter';

import { FLAG } from '@/config/feature-flag-definitions';
import { db } from '@/db';
import { whatsappSettings } from '@/db/schema';
import { loggers } from '@/utils/logger';
import { OpenFeature } from '@openfeature/server-sdk';
import { discordAdapter } from './discord-adapter';
import { evolutionAdapter } from './evolution-adapter';
import { telegramAdapter } from './telegram-adapter';
import type { MessagingProvider, ProviderType } from './types';

/**
 * Cache da API ativa do WhatsApp
 * Evita consultas ao banco a cada chamada
 */
let cachedApiType: 'evolution' | null = null;
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
 * Obtém a API ativa do WhatsApp
 * A partir da migração para Evolution, sempre retorna 'evolution'.
 */
async function getActiveWhatsAppApi(): Promise<'evolution'> {
	if (cachedApiType) {
		return cachedApiType;
	}

	cachedApiType = 'evolution';
	return cachedApiType;
}

/**
 * Provider factory - Retorna o adapter baseado no nome do provider
 * Para WhatsApp, lê a API ativa do banco de dados
 * Verifica channel flag antes de retornar — flag disabled → retorna null
 */
export async function getProvider(name: ProviderType): Promise<MessagingProvider | null> {
	// Verificar channel flag via OpenFeature (falha silenciosa se provider não inicializado ainda)
	try {
		const client = OpenFeature.getClient('nexo');
		const channelFlagMap: Record<string, string> = {
			telegram: FLAG.CHANNEL_TELEGRAM,
			discord: FLAG.CHANNEL_DISCORD,
			whatsapp: FLAG.CHANNEL_WHATSAPP,
		};
		const flagKey = channelFlagMap[name];
		if (flagKey) {
			const enabled = await client.getBooleanValue(flagKey, true);
			if (!enabled) {
				loggers.ai.warn({ channel: name }, '🚫 Canal desabilitado via feature flag');
				return null;
			}
		}
	} catch {
		// Provider OpenFeature não inicializado ainda — permitir passagem
	}

	if (name === 'telegram') return telegramAdapter;
	if (name === 'discord') return discordAdapter;

	if (name === 'whatsapp') {
		// Usar cache se disponível
		if (cachedWhatsAppProvider) {
			return cachedWhatsAppProvider;
		}

		await getActiveWhatsAppApi();
		cachedWhatsAppProvider = evolutionAdapter;
		loggers.ai.info('📱 Provider Evolution carregado');

		return cachedWhatsAppProvider;
	}

	return null;
}

/**
 * Mantido por compatibilidade durante migração do dashboard.
 * A API ativa agora é sempre Evolution.
 */
export async function setActiveWhatsAppApi(api: 'meta' | 'baileys' | 'evolution'): Promise<void> {
	if (api !== 'evolution') {
		loggers.ai.warn({ requestedApi: api }, '⚠️ API solicitada não suportada; mantendo Evolution como provider único');
	}

	// Atualizar no banco
	await db
		.insert(whatsappSettings)
		.values({
			id: 'global',
			activeApi: 'evolution',
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: whatsappSettings.id,
			set: {
				activeApi: 'evolution',
				updatedAt: new Date(),
			},
		});

	// Invalidar cache
	invalidateWhatsAppProviderCache();

	loggers.ai.info({ api: 'evolution' }, '✅ Provider WhatsApp definido para Evolution');
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
				activeApi: 'evolution',
			})
			.returning();
	} else if (settings.activeApi !== 'evolution') {
		await setActiveWhatsAppApi('evolution');
		[settings] = await db.select().from(whatsappSettings).limit(1);
	}

	return settings;
}

// Export síncrono para backward compatibility
// Nota: Para WhatsApp, use getProvider() async para garantir API correta
export function getProviderSync(name: ProviderType): MessagingProvider | null {
	if (name === 'telegram') return telegramAdapter;
	if (name === 'whatsapp') return evolutionAdapter;
	if (name === 'discord') return discordAdapter;
	return null;
}
