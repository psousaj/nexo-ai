import { z } from 'zod';

const basePayloadSchema = z.object({
	messageId: z.string().min(1),
	userId: z.string().min(1),
	timestamp: z.coerce.date().optional(),
	mimeType: z.string().min(1),
	url: z.string().url().optional(),
	base64: z.string().min(1).optional(),
	filename: z.string().min(1).optional(),
	byteLength: z.number().int().positive().optional(),
});

export const audioIntakePayloadSchema = basePayloadSchema.extend({
	kind: z.literal('audio'),
	languageHint: z.string().min(2).max(12).optional(),
});

export const imageIntakePayloadSchema = basePayloadSchema.extend({
	kind: z.literal('image'),
});

export const multimodalIntakePayloadSchema = z.discriminatedUnion('kind', [
	audioIntakePayloadSchema,
	imageIntakePayloadSchema,
]);

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
