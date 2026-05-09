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

export const FLAG_DEFINITIONS: FeatureFlagDefinition[] = [...pivotFlagDefinitions, ...channelFlagDefinitions];

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
	// Channels
	CHANNEL_TELEGRAM: 'nexo.channel.telegram',
	CHANNEL_DISCORD: 'nexo.channel.discord',
	CHANNEL_WHATSAPP: 'nexo.channel.whatsapp',
} as const;

export type FlagKey = (typeof FLAG)[keyof typeof FLAG];
