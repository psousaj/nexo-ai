import { z } from 'zod';

const MAX_INLINE_BASE64_CHAR_LENGTH = 10 * 1024 * 1024;
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:']);

const commonPayloadFields = {
	messageId: z.string().min(1),
	userId: z.string().min(1),
	timestamp: z.coerce.date().optional(),
	mimeType: z.string().min(1),
	url: z.string().url().optional(),
	base64: z.string().min(1).max(MAX_INLINE_BASE64_CHAR_LENGTH).optional(),
	filename: z.string().min(1).optional(),
	byteLength: z.number().int().positive().optional(),
};

function validateSingleTransport(value: { url?: string; base64?: string }, ctx: z.RefinementCtx) {
	const hasUrl = Boolean(value.url);
	const hasBase64 = Boolean(value.base64);

	if (hasUrl === hasBase64) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'payload must include exactly one transport: url or base64',
			path: ['url'],
		});
	}

	if (hasUrl && value.url) {
		const protocol = new URL(value.url).protocol;
		if (!ALLOWED_URL_PROTOCOLS.has(protocol)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'url transport must use http or https',
				path: ['url'],
			});
		}
	}
}

export const audioIntakePayloadSchema = z
	.object({
		...commonPayloadFields,
		kind: z.literal('audio'),
		languageHint: z.string().min(2).max(12).optional(),
	})
	.superRefine(validateSingleTransport);

export const imageIntakePayloadSchema = z
	.object({
		...commonPayloadFields,
		kind: z.literal('image'),
	})
	.superRefine(validateSingleTransport);

export const multimodalIntakePayloadSchema = z.union([audioIntakePayloadSchema, imageIntakePayloadSchema]);

const normalizedBaseSchema = z.object({
	kind: z.enum(['audio', 'image']),
	messageId: z.string().min(1),
	userId: z.string().min(1),
	timestamp: z.date(),
	mimeType: z.string().min(1),
	transport: z.enum(['url', 'base64']),
	content: z.string().min(1),
	filename: z.string().min(1).optional(),
	byteLength: z.number().int().positive().optional(),
});

export const normalizedAudioPayloadSchema = normalizedBaseSchema.extend({
	kind: z.literal('audio'),
	languageHint: z.string().min(2).max(12).optional(),
});

export const normalizedImagePayloadSchema = normalizedBaseSchema.extend({
	kind: z.literal('image'),
});

export const normalizedMultimodalPayloadSchema = z.discriminatedUnion('kind', [
	normalizedAudioPayloadSchema,
	normalizedImagePayloadSchema,
]);

export type AudioIntakePayload = z.infer<typeof audioIntakePayloadSchema>;
export type ImageIntakePayload = z.infer<typeof imageIntakePayloadSchema>;
export type MultimodalIntakePayload = z.infer<typeof multimodalIntakePayloadSchema>;
export type NormalizedAudioPayload = z.infer<typeof normalizedAudioPayloadSchema>;
export type NormalizedImagePayload = z.infer<typeof normalizedImagePayloadSchema>;
export type NormalizedMultimodalPayload = z.infer<typeof normalizedMultimodalPayloadSchema>;

export interface MultimodalFeatureFlags {
	MULTIMODAL_AUDIO: boolean;
	MULTIMODAL_IMAGE: boolean;
}
