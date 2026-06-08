/**
 * Feature Flag Definitions
 *
 * Fonte canônica de todas as feature flags do sistema.
 * Env vars dos pivot flags são usadas APENAS no seed inicial.
 * Após o primeiro boot, o BD é a fonte de verdade.
 */

import { env } from '@/config/env';

export type FlagCategory = 'pivot' | 'channel' | 'tool';

export interface FeatureFlagDefinition {
	key: string;
	label: string;
	description: string;
	category: FlagCategory;
	defaultEnabled: boolean;
}

// ============================================================================
// Pivot flags (5) — seed usa env var como valor inicial
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
<<<<<<< HEAD
	{
		key: 'nexo.pivot.provider-split',
		label: 'Provider Split',
		description: 'Divide processamento entre providers de IA',
		category: 'pivot',
		defaultEnabled: env.PROVIDER_SPLIT,
	},
=======
>>>>>>> development
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
		description: 'Habilita canal WhatsApp (Evolution API)',
		category: 'channel',
		defaultEnabled: true,
	},
];

// ============================================================================
// Exported constants
// ============================================================================

// ============================================================================
// Hermes validation flags
// ============================================================================
const hermesFlagDefinitions: FeatureFlagDefinition[] = [
	{
		key: 'nexo.hermes.shadow-replay-enabled',
		label: 'Hermes Shadow Replay',
		description: 'Executa shadow replay comparando Hermes vs legacy',
		category: 'pivot',
		defaultEnabled: false,
	},
	{
		key: 'nexo.hermes.validation-enabled',
		label: 'Hermes Validation',
		description: 'Habilita validação assistiva de respostas do Hermes',
		category: 'pivot',
		defaultEnabled: true,
	},
];

export const FLAG_DEFINITIONS: FeatureFlagDefinition[] = [
	...pivotFlagDefinitions,
	...channelFlagDefinitions,
	...hermesFlagDefinitions,
];

export const HERMES_CONFIG = {
	rolloutPercentage: { type: 'number', default: 0, min: 0, max: 100 },
} as const;

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
<<<<<<< HEAD
	PROVIDER_SPLIT: 'nexo.pivot.provider-split',

=======
>>>>>>> development
	// Channels
	CHANNEL_TELEGRAM: 'nexo.channel.telegram',
	CHANNEL_DISCORD: 'nexo.channel.discord',
	CHANNEL_WHATSAPP: 'nexo.channel.whatsapp',
<<<<<<< HEAD
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
=======
	// Hermes validation & rollout
	HERMES_SHADOW_REPLAY_ENABLED: 'nexo.hermes.shadow-replay-enabled',
	HERMES_ROLLOUT_PERCENTAGE: 'nexo.hermes.rollout-percentage',
	HERMES_VALIDATION_ENABLED: 'nexo.hermes.validation-enabled',
>>>>>>> development
} as const;

export type FlagKey = (typeof FLAG)[keyof typeof FLAG];
