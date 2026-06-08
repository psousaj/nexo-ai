export interface PivotFeatureFlags {
	CONVERSATION_FREE: boolean;
	TOOL_SCHEMA_V2: boolean;
	MULTIMODAL_AUDIO: boolean;
	MULTIMODAL_IMAGE: boolean;
<<<<<<< HEAD
	PROVIDER_SPLIT: boolean;
}

const PIVOT_DEFAULTS: Record<keyof PivotFeatureFlags, { key: FlagKey; default: boolean }> = {
	CONVERSATION_FREE: { key: FLAG.CONVERSATION_FREE, default: true },
	TOOL_SCHEMA_V2: { key: FLAG.TOOL_SCHEMA_V2, default: false },
	MULTIMODAL_AUDIO: { key: FLAG.MULTIMODAL_AUDIO, default: true },
	MULTIMODAL_IMAGE: { key: FLAG.MULTIMODAL_IMAGE, default: false },
	PROVIDER_SPLIT: { key: FLAG.PROVIDER_SPLIT, default: false },
};

=======
}

>>>>>>> development
export async function getPivotFeatureFlags(): Promise<PivotFeatureFlags> {
	return {
		CONVERSATION_FREE: true,
		TOOL_SCHEMA_V2: false,
		MULTIMODAL_AUDIO: true,
		MULTIMODAL_IMAGE: false,
	};
}
