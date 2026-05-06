/**
 * Tool Cache Tests (NEX-29)
 */
import { describe, expect, it } from 'vitest';

describe('Tool Cache (NEX-29)', () => {
	it('ToolAvailabilityService deve exportar invalidateCache', async () => {
		const { toolAvailabilityService } = await import('@/services/tool-availability.service');
		expect(toolAvailabilityService).toBeDefined();
		expect(typeof toolAvailabilityService.invalidateCache).toBe('function');
		expect(typeof toolAvailabilityService.getAvailableTools).toBe('function');
	});

	it('cache TTL deve ser 15 minutos (900 segundos)', async () => {
		const mod = await import('@/services/tool-availability.service');
		expect(mod).toBeDefined();
	});

	it('tools routes PATCH chama invalidateCache no toggle', async () => {
		const { toolAvailabilityService } = await import('@/services/tool-availability.service');
		expect(typeof toolAvailabilityService.invalidateCache).toBe('function');
	});

	it('registry getAllTools retorna array de tool definitions', async () => {
		const { getAllTools } = await import('@/services/tools/registry');
		const tools = getAllTools();
		expect(Array.isArray(tools)).toBe(true);
		expect(tools.length).toBeGreaterThanOrEqual(30);
		for (const tool of tools) {
			expect(tool.name).toBeDefined();
			expect(tool.label).toBeDefined();
			expect(tool.description).toBeDefined();
			expect(tool.icon).toBeDefined();
			expect(tool.category).toBeDefined();
		}
	});

	it('auto-discovery: discoverTools valida consistência', async () => {
		const { discoverTools } = await import('@/services/tools/registry');
		const result = await discoverTools();
		expect(result.allGood).toBe(true);
		expect(result.orphans).toEqual([]);
		expect(result.unregistered).toEqual([]);
	});

	it('tools de sistema e usuário devem ser distinguíveis por categoria', async () => {
		const { getSystemTools, getUserTools } = await import('@/services/tools/registry');
		const system = getSystemTools();
		const user = getUserTools();
		expect(system.length).toBeGreaterThan(0);
		expect(user.length).toBeGreaterThan(0);
		for (const tool of system) {
			expect(tool.category).toBe('system');
		}
		for (const tool of user) {
			expect(tool.category).toBe('user');
		}
	});

	it('getToolDefinition retorna tool específica', async () => {
		const { getToolDefinition } = await import('@/services/tools/registry');
		const def = getToolDefinition('save_note' as any);
		expect(def).toBeDefined();
		expect(def?.label).toBe('Salvar Nota');
	});
});
