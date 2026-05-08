import type { HermesToolDescriptor } from '../policies/policy-types';

export interface HermesToolRegistry {
	listEnabled(): Promise<HermesToolDescriptor[]>;
	execute(name: string, input: unknown): Promise<unknown>;
	buildHermesToolCatalog(): Promise<HermesToolDescriptor[]>;
}

export class PostgresToolRegistry implements HermesToolRegistry {
	private static readonly CATALOG: HermesToolDescriptor[] = [
		{
			name: 'search_items',
			description: 'Busca itens salvos na memória do usuário',
			jsonSchema: {
				type: 'object',
				properties: { query: { type: 'string' } },
				required: ['query'],
			},
			policy: 'auto',
			execute: async () => [],
		},
		{
			name: 'delete_all_memories',
			description: 'Apaga todas as memórias do usuário',
			jsonSchema: {
				type: 'object',
				properties: { confirmation: { type: 'string' } },
				required: ['confirmation'],
			},
			policy: 'confirm',
			execute: async () => [],
		},
	];

	async buildHermesToolCatalog(): Promise<HermesToolDescriptor[]> {
		return PostgresToolRegistry.CATALOG;
	}

	async listEnabled(): Promise<HermesToolDescriptor[]> {
		return PostgresToolRegistry.CATALOG;
	}

	async execute(name: string, _input: unknown): Promise<unknown> {
		const tool = PostgresToolRegistry.CATALOG.find((t) => t.name === name);
		if (!tool) throw new Error(`Tool ${name} not found`);
		return tool.execute(null, {});
	}
}
