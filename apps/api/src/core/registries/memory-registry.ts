export interface MemoryRegistry {
	store(input: unknown): Promise<unknown>;
	loadRelevant(input: unknown): Promise<unknown[]>;
}

export class PostgresMemoryRegistry implements MemoryRegistry {
	async store(input: unknown) {
		return input;
	}

	async loadRelevant(_input: unknown): Promise<Array<{ summary: string }>> {
		return [
			{ summary: 'O usuário prefere respostas concisas e diretas.' },
			{ summary: 'O usuário costuma fazer perguntas sobre tecnologia e programação.' },
		];
	}
}
