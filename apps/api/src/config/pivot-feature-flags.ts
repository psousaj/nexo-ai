import { env } from '@/config/env';

export interface PivotFeatureFlags {
	CONVERSATION_FREE: boolean;
	TOOL_SCHEMA_V2: boolean;
	MULTIMODAL_AUDIO: boolean;
	MULTIMODAL_IMAGE: boolean;
	PROVIDER_SPLIT: boolean;
	ELYSIA_RUNTIME: boolean;
}

export function getPivotFeatureFlags(): PivotFeatureFlags {
	return {
		CONVERSATION_FREE: env.CONVERSATION_FREE,
		TOOL_SCHEMA_V2: env.TOOL_SCHEMA_V2,
		MULTIMODAL_AUDIO: env.MULTIMODAL_AUDIO,
		MULTIMODAL_IMAGE: env.MULTIMODAL_IMAGE,
		PROVIDER_SPLIT: env.PROVIDER_SPLIT,
		ELYSIA_RUNTIME: env.ELYSIA_RUNTIME,
	};
}
