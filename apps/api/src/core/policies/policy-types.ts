export type ToolPolicy = 'auto' | 'confirm' | 'deny';

export interface HermesToolDescriptor {
	name: string;
	description: string;
	jsonSchema: Record<string, unknown>;
	policy: ToolPolicy;
	execute: (context: unknown, input: Record<string, unknown>) => Promise<unknown>;
}
