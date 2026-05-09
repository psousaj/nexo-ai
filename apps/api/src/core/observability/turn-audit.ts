export async function writeTurnAudit(input: {
	runType: string;
	sessionKey?: string;
	contextHash?: string;
	policies: string[];
	tools: string[];
}): Promise<{ runType: string }> {
	return { runType: input.runType };
}

export function buildUserFacingReason(input: { policy: 'auto' | 'confirm'; sourceSummary: string }): string {
	return input.policy === 'auto'
		? `Agi com base no contexto salvo: ${input.sourceSummary}`
		: `Preciso confirmar antes de agir sobre: ${input.sourceSummary}`;
}
