import type { HermesToolDescriptor } from '../policies/policy-types';

export async function executeToolWithPolicy(input: {
	descriptor: HermesToolDescriptor;
	execute: () => Promise<unknown>;
}): Promise<{
	status: 'success' | 'error' | 'blocked';
	requiresConfirmation: boolean;
	data?: unknown;
}> {
	if (input.descriptor.policy === 'deny') return { status: 'blocked', requiresConfirmation: false };
	if (input.descriptor.policy === 'confirm') return { status: 'blocked', requiresConfirmation: true };
	const data = await input.execute();
	return { status: 'success', requiresConfirmation: false, data };
}
