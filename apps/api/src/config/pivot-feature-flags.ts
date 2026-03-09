import { FLAG, type FlagKey } from '@/config/feature-flag-definitions';
import { featureFlagClient } from '@/services/feature-flag.service';

export interface PivotFeatureFlags {
	CONVERSATION_FREE: boolean;
	TOOL_SCHEMA_V2: boolean;
	MULTIMODAL_AUDIO: boolean;
	MULTIMODAL_IMAGE: boolean;
	PROVIDER_SPLIT: boolean;
	ELYSIA_RUNTIME: boolean;
}

const PIVOT_DEFAULTS: Record<keyof PivotFeatureFlags, { key: FlagKey; default: boolean }> = {
	CONVERSATION_FREE: { key: FLAG.CONVERSATION_FREE, default: true },
	TOOL_SCHEMA_V2: { key: FLAG.TOOL_SCHEMA_V2, default: false },
	MULTIMODAL_AUDIO: { key: FLAG.MULTIMODAL_AUDIO, default: false },
	MULTIMODAL_IMAGE: { key: FLAG.MULTIMODAL_IMAGE, default: false },
	PROVIDER_SPLIT: { key: FLAG.PROVIDER_SPLIT, default: false },
	ELYSIA_RUNTIME: { key: FLAG.ELYSIA_RUNTIME, default: false },
};

export async function getPivotFeatureFlags(): Promise<PivotFeatureFlags> {
	const result: PivotFeatureFlags = {} as PivotFeatureFlags;

	for (const [field, { key, default: defaultValue }] of Object.entries(PIVOT_DEFAULTS)) {
		result[field as keyof PivotFeatureFlags] = await featureFlagClient().getBooleanValue(key, defaultValue);
	}

	return result;
}
