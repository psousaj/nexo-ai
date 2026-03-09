import { Hono } from 'hono';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mockGetPivotFeatureFlags, mockGetWhatsAppSettings, mockInvalidateCache, mockSetActiveWhatsAppApi } = vi.hoisted(() => ({
	mockGetPivotFeatureFlags: vi.fn(),
	mockGetWhatsAppSettings: vi.fn(),
	mockInvalidateCache: vi.fn(),
	mockSetActiveWhatsAppApi: vi.fn(),
}));

vi.mock('@/config/pivot-feature-flags', () => ({
	getPivotFeatureFlags: mockGetPivotFeatureFlags,
}));

vi.mock('@/adapters/messaging', () => ({
	getWhatsAppSettings: mockGetWhatsAppSettings,
	invalidateWhatsAppProviderCache: mockInvalidateCache,
	setActiveWhatsAppApi: mockSetActiveWhatsAppApi,
}));

describe('Admin routes - pivot feature flags', () => {
	beforeEach(() => {
		mockGetPivotFeatureFlags.mockReset();
	});

	test('returns effective pivot feature flags and metadata', async () => {
		const { adminRoutes } = await import('@/routes/dashboard/admin.routes');

		mockGetPivotFeatureFlags.mockResolvedValue({
			CONVERSATION_FREE: true,
			TOOL_SCHEMA_V2: false,
			MULTIMODAL_AUDIO: true,
			MULTIMODAL_IMAGE: false,
			PROVIDER_SPLIT: false,
			ELYSIA_RUNTIME: true,
		});

		const app = new Hono().route('/admin', adminRoutes);
		const response = await app.request('http://localhost/admin/pivot-feature-flags');
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockGetPivotFeatureFlags).toHaveBeenCalledTimes(1);
		expect(body).toEqual({
			success: true,
			data: {
				flags: {
					CONVERSATION_FREE: true,
					TOOL_SCHEMA_V2: false,
					MULTIMODAL_AUDIO: true,
					MULTIMODAL_IMAGE: false,
					PROVIDER_SPLIT: false,
					ELYSIA_RUNTIME: true,
				},
				meta: {
					enabled: 3,
					total: 6,
				},
			},
		});
	});
});
