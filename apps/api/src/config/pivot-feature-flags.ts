export interface PivotFeatureFlags {
	CONVERSATION_FREE: boolean;
	TOOL_SCHEMA_V2: boolean;
	MULTIMODAL_AUDIO: boolean;
	MULTIMODAL_IMAGE: boolean;
	HERMES_ENGINE_ENABLED: boolean;
}

export async function getPivotFeatureFlags(): Promise<PivotFeatureFlags> {
	return {
		CONVERSATION_FREE: true,
		TOOL_SCHEMA_V2: false,
		MULTIMODAL_AUDIO: true,
		MULTIMODAL_IMAGE: false,
		HERMES_ENGINE_ENABLED: false,
	};
}
