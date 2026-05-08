import { db } from '@/db';
import { agentSkills } from '@/db/schema/agent-skills';
import { globalTools } from '@/db/schema/global-tools';
import type { HermesToolDescriptor } from '../policies/policy-types';

export interface HermesToolRegistry {
	listEnabled(): Promise<HermesToolDescriptor[]>;
	execute(name: string, input: unknown): Promise<unknown>;
	buildHermesToolCatalog(): Promise<HermesToolDescriptor[]>;
}

export class PostgresToolRegistry implements HermesToolRegistry {
	async buildHermesToolCatalog(): Promise<HermesToolDescriptor[]> {
		const dbTools = await db.select().from(globalTools);
		const skills = await db.select().from(agentSkills);

		return [
			...dbTools.map((t) => ({
				name: t.toolName,
				description: '',
				jsonSchema: {} as Record<string, unknown>,
				policy: 'auto' as const,
				execute: async () => ({ tool: t.toolName, status: 'executed' }),
			})),
			...skills.map((s) => ({
				name: s.name,
				description: s.description ?? '',
				jsonSchema: { type: 'object', properties: {} } as Record<string, unknown>,
				policy: 'auto' as const,
				execute: async () => ({ skill: s.name, status: 'executed' }),
			})),
		];
	}

	async listEnabled(): Promise<HermesToolDescriptor[]> {
		return this.buildHermesToolCatalog();
	}

	async execute(name: string, input: unknown): Promise<unknown> {
		const catalog = await this.buildHermesToolCatalog();
		const tool = catalog.find((t) => t.name === name);
		if (!tool) throw new Error(`Tool ${name} not found`);
		return tool.execute(null, input as Record<string, unknown>);
	}
}
