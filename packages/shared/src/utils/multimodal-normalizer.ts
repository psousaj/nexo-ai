import {
	type MultimodalFeatureFlags,
	type MultimodalIntakePayload,
	multimodalIntakePayloadSchema,
	normalizedMultimodalPayloadSchema,
} from '../contracts/multimodal-intake';

function assertFeatureFlag(payloadKind: 'audio' | 'image', flags: MultimodalFeatureFlags): void {
	if (payloadKind === 'audio' && !flags.MULTIMODAL_AUDIO) {
		throw new Error('MULTIMODAL_AUDIO feature flag is disabled');
	}

	if (payloadKind === 'image' && !flags.MULTIMODAL_IMAGE) {
		throw new Error('MULTIMODAL_IMAGE feature flag is disabled');
	}
}

function selectTransport(payload: MultimodalIntakePayload): { transport: 'url' | 'base64'; content: string } {
	if (payload.url) {
		return { transport: 'url', content: payload.url };
	}

	if (payload.base64) {
		return { transport: 'base64', content: payload.base64 };
	}

	throw new Error('payload must include exactly one transport: url or base64');
}

export function normalizeMultimodalPayload(
	payload: unknown,
	flags: MultimodalFeatureFlags,
	defaultTimestamp = new Date(),
) {
	const parsedPayload = multimodalIntakePayloadSchema.parse(payload) as MultimodalIntakePayload;
	assertFeatureFlag(parsedPayload.kind, flags);

	const { transport, content } = selectTransport(parsedPayload);

	return normalizedMultimodalPayloadSchema.parse({
		...parsedPayload,
		timestamp: parsedPayload.timestamp ?? defaultTimestamp,
		transport,
		content,
	});
}
