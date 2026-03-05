import { env } from '@nexo/env';
import type { MultimodalFeatureFlags } from '@nexo/shared';

export function getWorkerFeatureFlags(): MultimodalFeatureFlags {
	return {
		MULTIMODAL_AUDIO: env.MULTIMODAL_AUDIO,
		MULTIMODAL_IMAGE: env.MULTIMODAL_IMAGE,
	};
}
