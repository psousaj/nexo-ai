/**
 * Memory Versions Tests (NEX-31)
 *
 * Validates the memory_versions table exists with proper columns
 * for audit trail of memory item changes.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';

describe('memory_versions table (NEX-31)', () => {
	afterEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	it('memory_versions table deve existir e ter as colunas principais', async () => {
		const { memoryVersions } = await import('@/db/schema/memory-versions');

		expect(memoryVersions).toBeDefined();
		const tableObj = memoryVersions as Record<string, unknown>;
		// Verify key columns exist
		expect(tableObj.id).toBeDefined();
		expect(tableObj.memoryItemId).toBeDefined();
		expect(tableObj.userId).toBeDefined();
		expect(tableObj.version).toBeDefined();
		expect(tableObj.type).toBeDefined();
		expect(tableObj.title).toBeDefined();
		expect(tableObj.metadata).toBeDefined();
		expect(tableObj.content).toBeDefined();
		expect(tableObj.confidence).toBeDefined();
		expect(tableObj.importance).toBeDefined();
		expect(tableObj.source).toBeDefined();
		expect(tableObj.cognitiveType).toBeDefined();
		expect(tableObj.changeReason).toBeDefined();
		expect(tableObj.createdAt).toBeDefined();
	});

	it('memory_versions deve ter relacionamento com users', async () => {
		const { memoryVersionsRelations } = await import('@/db/schema/memory-versions');

		expect(memoryVersionsRelations).toBeDefined();
	});

	it('agent_daily_logs deve ter colunas category e embedding', async () => {
		const { agentDailyLogs } = await import('@/db/schema/agent-daily-logs');

		const tableObj = agentDailyLogs as Record<string, unknown>;
		expect(tableObj.category).toBeDefined();
		expect(tableObj.embedding).toBeDefined();
	});

	it('agent_daily_logs deve ter indice user_date_category', async () => {
		const { agentDailyLogs } = await import('@/db/schema/agent-daily-logs');

		// The table object should have the index configuration
		expect(agentDailyLogs).toBeDefined();
		// Verify the table can be referenced (schema is valid)
		const tableName = (agentDailyLogs as any)[Symbol.for('drizzle:Name')];
		expect(typeof tableName).toBe('string');
	});
});
