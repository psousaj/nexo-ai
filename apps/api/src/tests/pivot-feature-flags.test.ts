import { afterEach, describe, expect, test, vi } from 'vitest';

// Mock do featureFlagClient (OpenFeature) usando vi.mock + vi.hoisted
const { mockGetBooleanValue } = vi.hoisted(() => ({
	mockGetBooleanValue: vi.fn(),
}));

vi.mock('@/services/feature-flag.service', () => ({
	featureFlagClient: vi.fn(() => ({
		getBooleanValue: mockGetBooleanValue,
	})),
}));

afterEach(() => {
	vi.clearAllMocks();
	vi.resetModules();
});

describe('Pivot feature flags', () => {
	test('defaults CONVERSATION_FREE to true and all others to false when BD returns defaults', async () => {
		// Simula BD retornando valores padrão (como se env não estivesse setada)
		mockGetBooleanValue.mockImplementation((_key: string, defaultValue: boolean) => Promise.resolve(defaultValue));

		const { getPivotFeatureFlags } = await import('@/config/pivot-feature-flags');
		const flags = await getPivotFeatureFlags();

		expect(flags).toEqual({
			CONVERSATION_FREE: true,
			TOOL_SCHEMA_V2: false,
			MULTIMODAL_AUDIO: false,
			MULTIMODAL_IMAGE: false,
			PROVIDER_SPLIT: false,
			ELYSIA_RUNTIME: false,
		});
	});

	test('reads pivot flags from BD (overriding default)', async () => {
		const bdValues: Record<string, boolean> = {
			'nexo.pivot.conversation-free': true,
			'nexo.pivot.tool-schema-v2': false,
			'nexo.pivot.multimodal-audio': true,
			'nexo.pivot.multimodal-image': true,
			'nexo.pivot.provider-split': false,
			'nexo.pivot.elysia-runtime': true,
		};

		mockGetBooleanValue.mockImplementation((key: string) => Promise.resolve(bdValues[key] ?? false));

		const { getPivotFeatureFlags } = await import('@/config/pivot-feature-flags');
		const flags = await getPivotFeatureFlags();

		expect(flags).toEqual({
			CONVERSATION_FREE: true,
			TOOL_SCHEMA_V2: false,
			MULTIMODAL_AUDIO: true,
			MULTIMODAL_IMAGE: true,
			PROVIDER_SPLIT: false,
			ELYSIA_RUNTIME: true,
		});
	});
});
