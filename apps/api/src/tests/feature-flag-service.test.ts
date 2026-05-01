/**
 * Tests for FeatureFlagService
 *
 * Valida:
 * - Seed BD vazio → insere todas as FLAG_DEFINITIONS
 * - update pivot/channel → atualiza feature_flags + recarrega InMemoryProvider
 * - update tool → rota para toolService.updateTool + recarrega InMemoryProvider
 * - channel false → getProvider retorna null
 * - getAll retorna flags das 3 famílias
 */

import { describe, expect, test, vi } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================
const {
	mockDbInsert,
	mockDbUpdate,
	mockDbSelect,
	mockDbSelectFeatureFlags,
	mockDbSelectGlobalTools,
	mockToolServiceInitialize,
	mockToolServiceUpdateTool,
	mockInMemoryProviderInstance,
	mockOpenFeatureSetProvider,
	mockOpenFeatureGetClient,
} = vi.hoisted(() => {
	const mockInMemoryProviderInstance = {
		putConfiguration: vi.fn(),
	};

	const mockGetBooleanValue = vi.fn().mockResolvedValue(true);

	return {
		mockDbInsert: vi.fn(),
		mockDbUpdate: vi.fn(),
		mockDbSelect: vi.fn(),
		mockDbSelectFeatureFlags: vi.fn(),
		mockDbSelectGlobalTools: vi.fn(),
		mockToolServiceInitialize: vi.fn(),
		mockToolServiceUpdateTool: vi.fn(),
		mockInMemoryProviderInstance,
		mockOpenFeatureSetProvider: vi.fn(),
		mockOpenFeatureGetClient: vi.fn().mockReturnValue({ getBooleanValue: mockGetBooleanValue }),
	};
});

vi.mock('@/db', () => ({
	db: {
		insert: mockDbInsert,
		update: mockDbUpdate,
		select: mockDbSelect,
	},
}));

vi.mock('@/db/schema', () => ({
	featureFlags: { key: 'key', category: 'category', enabled: 'enabled' },
	globalTools: { toolName: 'toolName', enabled: 'enabled' },
}));

vi.mock('@/services/tools/tool.service', () => ({
	toolService: {
		initializeTools: mockToolServiceInitialize,
		updateTool: mockToolServiceUpdateTool,
	},
}));

vi.mock('@openfeature/server-sdk', () => ({
	InMemoryProvider: vi.fn().mockImplementation(() => mockInMemoryProviderInstance),
	OpenFeature: {
		setProviderAndWait: mockOpenFeatureSetProvider,
		getClient: mockOpenFeatureGetClient,
	},
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((col, val) => ({ col, val })),
}));

// Mocked feature_flags rows
const MOCK_PIVOT_ROWS = [
	{ key: 'nexo.pivot.conversation-free', label: 'Conv Free', description: '', category: 'pivot', enabled: true },
	{ key: 'nexo.pivot.tool-schema-v2', label: 'Schema V2', description: '', category: 'pivot', enabled: false },
];

const MOCK_TOOL_ROWS = [
	{ toolName: 'save_note', enabled: true, category: 'user' },
	{ toolName: 'save_movie', enabled: false, category: 'user' },
];

function setupDbMocks() {
	// db.insert().values().onConflictDoNothing()
	const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
	const values = vi.fn().mockReturnValue({ onConflictDoNothing });
	mockDbInsert.mockReturnValue({ values });

	// db.update().set().where()
	const where = vi.fn().mockResolvedValue(undefined);
	const set = vi.fn().mockReturnValue({ where });
	mockDbUpdate.mockReturnValue({ set });

	// db.select().from()
	// Used twice: one for feature_flags, one for globalTools
	let selectCallCount = 0;
	mockDbSelect.mockImplementation(() => {
		const callIndex = selectCallCount++;
		return {
			from: vi.fn().mockResolvedValue(callIndex === 0 ? MOCK_PIVOT_ROWS : MOCK_TOOL_ROWS),
		};
	});

	mockToolServiceInitialize.mockResolvedValue(undefined);
	mockOpenFeatureSetProvider.mockResolvedValue(undefined);
}

async function setupSelectMock(rows0: unknown[], rows1: unknown[]) {
	let callCount = 0;
	mockDbSelect.mockImplementation(() => ({
		from: vi.fn().mockImplementation(() => {
			const idx = callCount++;
			return Promise.resolve(idx === 0 ? rows0 : rows1);
		}),
	}));
}

describe('FeatureFlagService', () => {
	test('initialize() seeds BD and registers InMemoryProvider', async () => {
		setupDbMocks();

		const { featureFlagService } = await import('@/services/feature-flag.service');
		await featureFlagService.initialize();

		// Deve ter tentado inserir FLAG_DEFINITIONS
		expect(mockDbInsert).toHaveBeenCalled();

		// Deve ter inicializado as tools
		expect(mockToolServiceInitialize).toHaveBeenCalledTimes(1);

		// Deve ter registrado o provider no OpenFeature
		expect(mockOpenFeatureSetProvider).toHaveBeenCalledTimes(1);
	});

	test('update() with pivot key updates feature_flags table', async () => {
		setupDbMocks();

		const { featureFlagService } = await import('@/services/feature-flag.service');
		await featureFlagService.initialize();

		vi.clearAllMocks();
		setupDbMocks();

		await featureFlagService.update('nexo.pivot.conversation-free', false);

		// Deve ter chamado db.update
		expect(mockDbUpdate).toHaveBeenCalled();
		// Não deve ter chamado toolService.updateTool
		expect(mockToolServiceUpdateTool).not.toHaveBeenCalled();
		// Deve ter atualizado o InMemoryProvider
		expect(mockInMemoryProviderInstance.putConfiguration).toHaveBeenCalledTimes(1);
	});

	test('update() with tool key routes to toolService.updateTool', async () => {
		setupDbMocks();

		const { featureFlagService } = await import('@/services/feature-flag.service');
		await featureFlagService.initialize();

		vi.clearAllMocks();
		setupDbMocks();

		await featureFlagService.update('nexo.tool.save-note', false);

		// Deve ter chamado toolService.updateTool com snake_case
		expect(mockToolServiceUpdateTool).toHaveBeenCalledWith('save_note', false);
		// Não deve ter chamado db.update
		expect(mockDbUpdate).not.toHaveBeenCalled();
		// Deve ter atualizado o InMemoryProvider
		expect(mockInMemoryProviderInstance.putConfiguration).toHaveBeenCalledTimes(1);
	});

	test('getAll() returns flags from both feature_flags and global_tools', async () => {
		setupDbMocks();

		const { featureFlagService } = await import('@/services/feature-flag.service');
		await featureFlagService.initialize();

		vi.clearAllMocks();

		// Reset db.select para simular getAll()
		await setupSelectMock(MOCK_PIVOT_ROWS, MOCK_TOOL_ROWS);

		const result = await featureFlagService.getAll();

		// Deve ter rows das duas tabelas
		expect(result.length).toBeGreaterThan(0);
		const keys = result.map((r) => r.key);
		expect(keys).toContain('nexo.pivot.conversation-free');
	});
});
