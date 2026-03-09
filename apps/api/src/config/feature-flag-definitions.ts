/**
 * Feature Flag Definitions
 *
 * Fonte canônica de todas as feature flags do sistema.
 * Env vars dos pivot flags são usadas APENAS no seed inicial.
 * Após o primeiro boot, o BD é a fonte de verdade.
 */

import { env } from '@/config/env';
import { getAllTools } from '@/services/tools/registry';

export type FlagCategory = 'pivot' | 'channel' | 'tool';

export interface FeatureFlagDefinition {
	key: string;
	label: string;
	description: string;
	category: FlagCategory;
	defaultEnabled: boolean;
}

// ============================================================================
// Pivot flags (6) — seed usa env var como valor inicial
// ============================================================================
const pivotFlagDefinitions: FeatureFlagDefinition[] = [
	{
		key: 'nexo.pivot.conversation-free',
		label: 'Conversa Gratuita',
		description: 'Permite uso sem assinatura ativa',
		category: 'pivot',
		defaultEnabled: env.CONVERSATION_FREE,
	},
	{
		key: 'nexo.pivot.tool-schema-v2',
		label: 'Tool Schema V2',
		description: 'Usa o novo schema de ferramentas (v2)',
		category: 'pivot',
		defaultEnabled: env.TOOL_SCHEMA_V2,
	},
	{
		key: 'nexo.pivot.multimodal-audio',
		label: 'Áudio Multimodal',
		description: 'Processa mensagens de áudio com IA',
		category: 'pivot',
		defaultEnabled: env.MULTIMODAL_AUDIO,
	},
	{
		key: 'nexo.pivot.multimodal-image',
		label: 'Imagem Multimodal',
		description: 'Processa imagens com IA',
		category: 'pivot',
		defaultEnabled: env.MULTIMODAL_IMAGE,
	},
	{
		key: 'nexo.pivot.provider-split',
		label: 'Provider Split',
		description: 'Divide processamento entre providers de IA',
		category: 'pivot',
		defaultEnabled: env.PROVIDER_SPLIT,
	},
	{
		key: 'nexo.pivot.elysia-runtime',
		label: 'Elysia Runtime',
		description: 'Usa runtime Elysia (experimental)',
		category: 'pivot',
		defaultEnabled: env.ELYSIA_RUNTIME,
	},
];

// ============================================================================
// Channel flags (4) — defaults hardcoded
// ============================================================================
const channelFlagDefinitions: FeatureFlagDefinition[] = [
	{
		key: 'nexo.channel.telegram',
		label: 'Telegram',
		description: 'Habilita canal Telegram',
		category: 'channel',
		defaultEnabled: true,
	},
	{
		key: 'nexo.channel.discord',
		label: 'Discord',
		description: 'Habilita canal Discord',
		category: 'channel',
		defaultEnabled: true,
	},
	{
		key: 'nexo.channel.whatsapp',
		label: 'WhatsApp',
		description: 'Habilita canal WhatsApp (Meta API)',
		category: 'channel',
		defaultEnabled: true,
	},
	{
		key: 'nexo.channel.whatsapp-baileys',
		label: 'WhatsApp (Baileys)',
		description: 'Habilita canal WhatsApp via Baileys (não-oficial)',
		category: 'channel',
		defaultEnabled: false,
	},
];

// ============================================================================
// Tool flags (21) — todos enabled por padrão, gerados do registry
// ============================================================================
function buildToolFlagDefinitions(): FeatureFlagDefinition[] {
	return getAllTools().map((tool) => ({
		key: `nexo.tool.${tool.name.replace(/_/g, '-')}`,
		label: tool.label,
		description: tool.description,
		category: 'tool' as FlagCategory,
		defaultEnabled: true,
	}));
}

// ============================================================================
// Exported constants
// ============================================================================

/** Todas as definições de flags (pivot + channel). Tools ficam em global_tools. */
export const FLAG_DEFINITIONS: FeatureFlagDefinition[] = [...pivotFlagDefinitions, ...channelFlagDefinitions];

/** Definições de tool flags (para seed do global_tools via OpenFeature) */
export const TOOL_FLAG_DEFINITIONS: FeatureFlagDefinition[] = buildToolFlagDefinitions();

/**
 * Chaves type-safe de todas as flags (pivot + channel + tool)
 *
 * Uso: FLAG['nexo.pivot.conversation-free']
 */
export const FLAG = {
	// Pivot
	CONVERSATION_FREE: 'nexo.pivot.conversation-free',
	TOOL_SCHEMA_V2: 'nexo.pivot.tool-schema-v2',
	MULTIMODAL_AUDIO: 'nexo.pivot.multimodal-audio',
	MULTIMODAL_IMAGE: 'nexo.pivot.multimodal-image',
	PROVIDER_SPLIT: 'nexo.pivot.provider-split',
	ELYSIA_RUNTIME: 'nexo.pivot.elysia-runtime',
	// Channels
	CHANNEL_TELEGRAM: 'nexo.channel.telegram',
	CHANNEL_DISCORD: 'nexo.channel.discord',
	CHANNEL_WHATSAPP: 'nexo.channel.whatsapp',
	CHANNEL_WHATSAPP_BAILEYS: 'nexo.channel.whatsapp-baileys',
	// Tools
	TOOL_SAVE_NOTE: 'nexo.tool.save-note',
	TOOL_SAVE_MOVIE: 'nexo.tool.save-movie',
	TOOL_SAVE_TV_SHOW: 'nexo.tool.save-tv-show',
	TOOL_SAVE_VIDEO: 'nexo.tool.save-video',
	TOOL_SAVE_LINK: 'nexo.tool.save-link',
	TOOL_SEARCH_ITEMS: 'nexo.tool.search-items',
	TOOL_ENRICH_MOVIE: 'nexo.tool.enrich-movie',
	TOOL_ENRICH_TV_SHOW: 'nexo.tool.enrich-tv-show',
	TOOL_ENRICH_VIDEO: 'nexo.tool.enrich-video',
	TOOL_DELETE_MEMORY: 'nexo.tool.delete-memory',
	TOOL_DELETE_ALL_MEMORIES: 'nexo.tool.delete-all-memories',
	TOOL_GET_ASSISTANT_NAME: 'nexo.tool.get-assistant-name',
	TOOL_UPDATE_USER_SETTINGS: 'nexo.tool.update-user-settings',
	TOOL_MEMORY_SEARCH: 'nexo.tool.memory-search',
	TOOL_MEMORY_GET: 'nexo.tool.memory-get',
	TOOL_DAILY_LOG_SEARCH: 'nexo.tool.daily-log-search',
	TOOL_LIST_CALENDAR_EVENTS: 'nexo.tool.list-calendar-events',
	TOOL_CREATE_CALENDAR_EVENT: 'nexo.tool.create-calendar-event',
	TOOL_LIST_TODOS: 'nexo.tool.list-todos',
	TOOL_CREATE_TODO: 'nexo.tool.create-todo',
	TOOL_SCHEDULE_REMINDER: 'nexo.tool.schedule-reminder',
} as const;

export type FlagKey = (typeof FLAG)[keyof typeof FLAG];
