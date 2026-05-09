import { db } from '@/db';
import { turnAudits } from '@/db/schema/turn-audits';
import { loggers } from '@/utils/logger';

export async function writeTurnAudit(input: {
	runType: string;
	sessionKey?: string;
	contextHash?: string;
	policies: string[];
	tools: string[];
}): Promise<{ runType: string }> {
	try {
		await db.insert(turnAudits).values({
			sessionKey: input.sessionKey ?? 'unknown',
			runType: input.runType,
			policies: input.policies,
			tools: input.tools,
			contextHash: input.contextHash ?? '',
		});
	} catch (err) {
		loggers.enrichment.error({ err }, 'Turn audit: failed to write');
	}
	return { runType: input.runType };
}

export function buildUserFacingReason(input: { policy: 'auto' | 'confirm'; sourceSummary: string }): string {
	return input.policy === 'auto'
		? `Agi com base no contexto salvo: ${input.sourceSummary}`
		: `Preciso confirmar antes de agir sobre: ${input.sourceSummary}`;
}
