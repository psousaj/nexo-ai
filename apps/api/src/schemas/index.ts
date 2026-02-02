import { z } from 'zod';
import type { ItemType } from '@/types';

/**
 * Schema para verificação do webhook do Meta
 */
// Re-export shared schemas
export * from '@nexo/shared';

// Schemas específicos da API (Webhooks)
export const webhookVerifySchema = z.object({
	'hub.mode': z.literal('subscribe'),
	'hub.verify_token': z.string(),
	'hub.challenge': z.string(),
});

export const whatsappMessageSchema = z.object({
	from: z.string(),
	id: z.string(),
	timestamp: z.string(),
	text: z
		.object({
			body: z.string(),
		})
		.optional(),
	type: z.string(),
});

export const whatsappWebhookPayloadSchema = z.object({
	object: z.literal('whatsapp_business_account'),
	entry: z.array(
		z.object({
			id: z.string(),
			changes: z.array(
				z.object({
					value: z.object({
						messaging_product: z.literal('whatsapp'),
						metadata: z.object({
							display_phone_number: z.string(),
							phone_number_id: z.string(),
						}),
						contacts: z
							.array(
								z.object({
									profile: z.object({
										name: z.string(),
									}),
									wa_id: z.string(),
								}),
							)
							.optional(),
						messages: z.array(whatsappMessageSchema).optional(),
					}),
					field: z.literal('messages'),
				}),
			),
		}),
	),
});
