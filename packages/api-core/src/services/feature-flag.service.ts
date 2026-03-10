/**
 * FeatureFlagService
 *
 * Unifica as 3 famílias de flags no OpenFeature:
 * - nexo.pivot.*  (6) → tabela feature_flags
 * - nexo.channel.* (4) → tabela feature_flags
 * - nexo.tool.*   (21) → tabela global_tools (via toolService)
 *
 * Ao boot:
 *  1. Seed feature_flags com FLAG_DEFINITIONS (onConflictDoNothing → não sobrescreve)
 *  2. Seed global_tools via toolService.initializeTools() (idem)
 *  3. Constrói FLAG_CONFIGURATION a partir do BD
 *  4. Registra InMemoryProvider no OpenFeature
 *
 * Ao atualizar:
 *  1. Persiste no BD (routing por categoria)
 *  2. Reconstrói config e chama provider.putConfiguration() → sem restart
 */

import { FLAG_DEFINITIONS, TOOL_FLAG_DEFINITIONS } from '@/config/feature-flag-definitions';
import { db } from '@/db';
import { featureFlags, globalTools } from '@/db/schema';
import { toolService } from '@/services/tools/tool.service';
import type { ToolName } from '@/types';
import { loggers } from '@/utils/logger';
import { InMemoryProvider, OpenFeature } from '@openfeature/server-sdk';
import { eq } from 'drizzle-orm';

// FlagConfiguration not exported from @openfeature/server-sdk — extract via ConstructorParameters
type FlagConfiguration = NonNullable<ConstructorParameters<typeof InMemoryProvider>[0]>;
type FlagVariant = FlagConfiguration[string];

// Helpers para montar FlagConfiguration compatível com InMemoryProvider
function buildFlagConfig(_key: string, enabled: boolean): FlagVariant {
	return {
		variants: { on: true, off: false },
		disabled: false,
		defaultVariant: enabled ? 'on' : 'off',
	};
}

export interface FlagRow {
	key: string;
	label: string;
	description: string;
	category: string;
	enabled: boolean;
}

class FeatureFlagService {
	private provider: InMemoryProvider | null = null;

	/**
	 * Inicializa o serviço: seed BD → constrói config → registra provider
	 * Deve ser chamado uma vez no startup, antes de qualquer rota.
	 */
	async initialize(): Promise<void> {
		loggers.app.info('🚩 Inicializando FeatureFlagService...');

		// Seed pivot + channel flags (onConflictDoNothing = respeita admin changes)
		await db
			.insert(featureFlags)
			.values(
				FLAG_DEFINITIONS.map((d) => ({
					key: d.key,
					label: d.label,
					description: d.description,
					category: d.category,
					enabled: d.defaultEnabled,
				})),
			)
			.onConflictDoNothing();

		// Seed tool flags via toolService (já usa onConflictDoNothing internamente)
		await toolService.initializeTools();

		// Construir e registrar provider
		const config = await this.buildFlagConfiguration();
		this.provider = new InMemoryProvider(config);
		await OpenFeature.setProviderAndWait('nexo', this.provider);

		const total = Object.keys(config).length;
		const enabled = Object.values(config).filter((f) => f.defaultVariant === 'on').length;
		loggers.app.info({ total, enabled }, '✅ FeatureFlagService iniciado');
	}

	/**
	 * Constrói FlagConfiguration combinando feature_flags + global_tools
	 */
	private async buildFlagConfiguration(): Promise<FlagConfiguration> {
		const config: FlagConfiguration = {};

		// Pivot + channel (de feature_flags)
		const rows = await db.select().from(featureFlags);
		for (const row of rows) {
			config[row.key] = buildFlagConfig(row.key, row.enabled);
		}

		// Tool flags (de global_tools), usando convenção nexo.tool.<name-kebab>
		const toolRows = await db.select().from(globalTools);
		for (const tool of toolRows) {
			const flagKey = `nexo.tool.${tool.toolName.replace(/_/g, '-')}`;
			config[flagKey] = buildFlagConfig(flagKey, tool.enabled);
		}

		// Garantir que todas as tool flags existam mesmo se global_tools vazio
		if (toolRows.length === 0) {
			for (const def of TOOL_FLAG_DEFINITIONS) {
				config[def.key] = buildFlagConfig(def.key, def.defaultEnabled);
			}
		}

		return config;
	}

	/**
	 * Retorna todas as flags com metadados (pivot + channel + tool)
	 */
	async getAll(category?: string): Promise<FlagRow[]> {
		// Pivot + channel
		const pivotChannelRows = await db
			.select()
			.from(featureFlags)
			.then((rows) => (category && category !== 'tool' ? rows.filter((r) => r.category === category) : rows));

		// Tool rows
		const toolRows =
			!category || category === 'tool'
				? await db
						.select()
						.from(globalTools)
						.then((rows) =>
							rows.map((t) => {
								const def = TOOL_FLAG_DEFINITIONS.find((d) => d.key === `nexo.tool.${t.toolName.replace(/_/g, '-')}`);
								return {
									key: `nexo.tool.${t.toolName.replace(/_/g, '-')}`,
									label: def?.label ?? t.toolName,
									description: def?.description ?? '',
									category: 'tool',
									enabled: t.enabled,
								};
							}),
						)
				: [];

		return [...pivotChannelRows, ...toolRows];
	}

	/**
	 * Atualiza uma flag pelo key
	 * Roteamento:
	 * - nexo.tool.* → global_tools (via toolService)
	 * - nexo.pivot.* / nexo.channel.* → feature_flags
	 */
	async update(key: string, enabled: boolean): Promise<void> {
		if (key.startsWith('nexo.tool.')) {
			// Converter kebab-case de volta para snake_case
			const toolName = key.replace('nexo.tool.', '').replace(/-/g, '_') as ToolName;
			await toolService.updateTool(toolName, enabled);
		} else {
			await db.update(featureFlags).set({ enabled, updatedAt: new Date() }).where(eq(featureFlags.key, key));
		}

		// Reconstruir e atualizar InMemoryProvider sem restart
		if (this.provider) {
			const config = await this.buildFlagConfiguration();
			this.provider.putConfiguration(config);
			loggers.app.info({ key, enabled }, '🔄 Feature flag atualizada (runtime)');
		}
	}

	/**
	 * Retorna o client OpenFeature para consultas de flag
	 */
	get client() {
		return OpenFeature.getClient('nexo');
	}
}

export const featureFlagService = new FeatureFlagService();

/**
 * Atalho para o client OpenFeature — uso: featureFlagClient.getBooleanValue(FLAG.X, defaultValue)
 * Resolve lazy para suportar chamadas antes do provider ser registrado (retorna default).
 */
export function featureFlagClient() {
	return OpenFeature.getClient('nexo');
}
