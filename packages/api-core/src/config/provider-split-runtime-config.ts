import type { PivotFeatureFlags } from '@/config/pivot-feature-flags';

export interface ProviderSplitRuntimeConfigPayload {
	version: '1.0';
	providerSplitEnabled: boolean;
	flags: PivotFeatureFlags;
	fetchedAt: string;
}

export interface ProviderSplitRuntimeConfigResponse {
	success: true;
	data: ProviderSplitRuntimeConfigPayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isPivotFeatureFlags(value: unknown): value is PivotFeatureFlags {
	if (!isRecord(value)) {
		return false;
	}

	return (
		typeof value.CONVERSATION_FREE === 'boolean' &&
		typeof value.TOOL_SCHEMA_V2 === 'boolean' &&
		typeof value.MULTIMODAL_AUDIO === 'boolean' &&
		typeof value.MULTIMODAL_IMAGE === 'boolean' &&
		typeof value.PROVIDER_SPLIT === 'boolean' &&
		typeof value.ELYSIA_RUNTIME === 'boolean'
	);
}

export function isProviderSplitRuntimeConfigResponse(
	candidate: unknown,
): candidate is ProviderSplitRuntimeConfigResponse {
	if (!isRecord(candidate) || candidate.success !== true) {
		return false;
	}

	const data = candidate.data;
	if (!isRecord(data)) {
		return false;
	}

	return (
		data.version === '1.0' &&
		typeof data.providerSplitEnabled === 'boolean' &&
		typeof data.fetchedAt === 'string' &&
		isPivotFeatureFlags(data.flags)
	);
}
