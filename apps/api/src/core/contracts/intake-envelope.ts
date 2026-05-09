export interface IntakeEnvelope {
	envelopeId: string;
	channel: 'telegram' | 'whatsapp';
	providerEventId: string;
	sessionKey: string;
	receivedAt: string;
	messageKind: 'text' | 'audio' | 'image' | 'link' | 'mixed';
	rawText: string;
	attachments: unknown[];
	idempotencyKey: string;
}

export function toIntakeEnvelope(job: {
	channel: string;
	eventId: string;
	idempotencyKey: string;
	occurredAt: string;
	payload: {
		providerName: string;
		incomingMsg: {
			messageId: string;
			externalId: string;
			text: string;
			timestamp: Date;
			provider: string;
			metadata?: { isGroupMessage?: boolean; messageType?: string };
		};
	};
}): IntakeEnvelope {
	const msg = job.payload.incomingMsg;
	const messageType = msg.metadata?.messageType ?? 'text';
	return {
		envelopeId: job.eventId,
		channel: job.channel as IntakeEnvelope['channel'],
		providerEventId: msg.messageId,
		sessionKey: `${job.payload.providerName}:${msg.externalId}`,
		receivedAt: job.occurredAt,
		messageKind: messageType as IntakeEnvelope['messageKind'],
		rawText: msg.text,
		attachments: [],
		idempotencyKey: job.idempotencyKey,
	};
}
