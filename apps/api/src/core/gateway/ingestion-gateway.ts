import { toIntakeEnvelope, type IntakeEnvelope } from '../contracts/intake-envelope';
import type { SessionRegistry } from '../registries/session-registry';

export interface CanonicalMessageEnvelope<T = unknown> {
	channel: string;
	eventId: string;
	idempotencyKey: string;
	occurredAt: string;
	payload: T;
}

export interface IngestMessageQueuePayload {
	providerName: string;
	incomingMsg: {
		messageId: string;
		externalId: string;
		text: string;
		timestamp: Date;
		provider: string;
		metadata?: { isGroupMessage?: boolean; messageType?: string };
	};
}

export interface IngestionResult extends IntakeEnvelope {
	sessionKey: string;
}

export class IngestionGateway {
	constructor(
		private deps: {
			sessionRegistry: SessionRegistry;
			resolveSessionKey: (msg: IngestMessageQueuePayload['incomingMsg']) => string;
		},
	) {}

	async ingest(job: CanonicalMessageEnvelope<IngestMessageQueuePayload>): Promise<IngestionResult> {
		const intake = toIntakeEnvelope(job);
		const sessionKey = this.deps.resolveSessionKey(job.payload.incomingMsg);
		return { ...intake, sessionKey };
	}
}
