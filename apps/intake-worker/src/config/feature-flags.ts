import type { MultimodalFeatureFlags } from '@nexo/shared';
import { getWorkerEnv } from './env';

export function getWorkerFeatureFlags(): MultimodalFeatureFlags {
	const env = getWorkerEnv();

	return {
		MULTIMODAL_AUDIO: env.MULTIMODAL_AUDIO,
		MULTIMODAL_IMAGE: env.MULTIMODAL_IMAGE,
	};
}
