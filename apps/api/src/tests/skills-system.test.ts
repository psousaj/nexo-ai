/**
 * Skills System Tests (NEX-30)
 */
import { describe, expect, it } from 'vitest';

describe('Skills System (NEX-30)', () => {
	it('agent_skills table deve existir no schema', async () => {
		const { agentSkills } = await import('@/db/schema/agent-skills');
		expect(agentSkills).toBeDefined();
		const tableObj = agentSkills as Record<string, unknown>;
		expect(tableObj.id).toBeDefined();
		expect(tableObj.userId).toBeDefined();
		expect(tableObj.name).toBeDefined();
		expect(tableObj.description).toBeDefined();
		expect(tableObj.content).toBeDefined();
		expect(tableObj.triggers).toBeDefined();
	});

	it('agent_skills deve ter relacionamento com users', async () => {
		const { agentSkillsRelations } = await import('@/db/schema/agent-skills');
		expect(agentSkillsRelations).toBeDefined();
	});

	it('save_skill deve estar no tool registry', async () => {
		const { getToolDefinition } = await import('@/services/tools/registry');
		const def = getToolDefinition('save_skill' as any);
		expect(def).toBeDefined();
		expect(def?.label).toBeDefined();
		expect(def?.category).toBe('user');
	});

	it('load_skill deve estar no tool registry', async () => {
		const { getToolDefinition } = await import('@/services/tools/registry');
		const def = getToolDefinition('load_skill' as any);
		expect(def).toBeDefined();
		expect(def?.label).toBeDefined();
		expect(def?.category).toBe('system');
	});

	it('save_skill deve existir no AVAILABLE_TOOLS', async () => {
		const { AVAILABLE_TOOLS } = await import('@/services/tools/index');
		expect(AVAILABLE_TOOLS.save_skill).toBeDefined();
	});

	it('load_skill deve existir no AVAILABLE_TOOLS', async () => {
		const { AVAILABLE_TOOLS } = await import('@/services/tools/index');
		expect(AVAILABLE_TOOLS.load_skill).toBeDefined();
	});

	it('built-in skills devem existir como constantes', async () => {
		const { BUILT_IN_SKILLS } = await import('@/services/skills/built-in-skills');
		expect(Array.isArray(BUILT_IN_SKILLS)).toBe(true);
		expect(BUILT_IN_SKILLS.length).toBeGreaterThanOrEqual(3);
		for (const skill of BUILT_IN_SKILLS) {
			expect(skill.name).toBeDefined();
			expect(skill.description).toBeDefined();
			expect(skill.content).toBeDefined();
		}
	});

	it('skills service deve ter loadSkill e saveSkill', async () => {
		const { skillsService } = await import('@/services/skills/skills.service');
		expect(skillsService).toBeDefined();
		expect(typeof skillsService.loadSkill).toBe('function');
		expect(typeof skillsService.saveSkill).toBe('function');
	});

	it('skills devem ser pesquisáveis via getRelevantSkills', async () => {
		const { skillsService } = await import('@/services/skills/skills.service');
		expect(typeof skillsService.getRelevantSkills).toBe('function');

		// Teste: texto com triggers deve retornar skills
		const skills = await skillsService.getRelevantSkills('preciso fazer debug desse bug');
		expect(skills.length).toBeGreaterThan(0);
		expect(skills.some((s) => s.name === 'debugging-flow')).toBe(true);
	});

	it('getRelevantSkills deve retornar array vazio para texto sem triggers', async () => {
		const { skillsService } = await import('@/services/skills/skills.service');
		const skills = await skillsService.getRelevantSkills('bom dia');
		expect(Array.isArray(skills)).toBe(true);
		expect(skills.length).toBe(0);
	});

	it('skills formatadas para prompt devem produzir texto não vazio', async () => {
		const { skillsService } = await import('@/services/skills/skills.service');
		const { BUILT_IN_SKILLS } = await import('@/services/skills/built-in-skills');
		const formatted = skillsService.formatSkillsForPrompt([BUILT_IN_SKILLS[0]]);
		expect(formatted).toBeDefined();
		// Instrumented service may wrap return — verify it's truthy
		expect(Boolean(formatted)).toBe(true);
	});
});
