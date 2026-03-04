import { afterEach, describe, expect, test, vi } from 'vitest';

const PIVOT_FLAG_KEYS = [
	'CONVERSATION_FREE',
	'TOOL_SCHEMA_V2',
	'MULTIMODAL_AUDIO',
	'MULTIMODAL_IMAGE',
	'PROVIDER_SPLIT',
	'ELYSIA_RUNTIME',
] as const;

const originalFlagValues = Object.fromEntries(PIVOT_FLAG_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
	for (const key of PIVOT_FLAG_KEYS) {
		const originalValue = originalFlagValues[key];
		if (originalValue === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = originalValue;
		}
	}
	vi.resetModules();
});

describe('Pivot feature flags', () => {
	test('defaults all pivot flags to false when env vars are not set', async () => {
		for (const key of PIVOT_FLAG_KEYS) {
			delete process.env[key];
		}

		vi.resetModules();
		const { getPivotFeatureFlags } = await import('@/config/pivot-feature-flags');
		const flags = getPivotFeatureFlags();

		expect(flags).toEqual({
			CONVERSATION_FREE: false,
			TOOL_SCHEMA_V2: false,
			MULTIMODAL_AUDIO: false,
			MULTIMODAL_IMAGE: false,
			PROVIDER_SPLIT: false,
			ELYSIA_RUNTIME: false,
		});
	});

	test('reads pivot flags from env using boolean parsing', async () => {
		process.env.CONVERSATION_FREE = 'true';
		process.env.TOOL_SCHEMA_V2 = 'false';
		process.env.MULTIMODAL_AUDIO = 'true';
		process.env.MULTIMODAL_IMAGE = 'true';
		process.env.PROVIDER_SPLIT = 'false';
		process.env.ELYSIA_RUNTIME = 'true';

		vi.resetModules();
		const { getPivotFeatureFlags } = await import('@/config/pivot-feature-flags');
		const flags = getPivotFeatureFlags();

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
