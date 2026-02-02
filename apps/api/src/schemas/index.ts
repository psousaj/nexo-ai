import { z } from "zod";
import type { ItemType } from "@/types";

/**
 * Schema para verificação do webhook do Meta
 */
export const webhookVerifySchema = z.object({
  "hub.mode": z.literal("subscribe"),
  "hub.verify_token": z.string(),
  "hub.challenge": z.string(),
});

/**
 * Schema para mensagens do WhatsApp webhook
 */
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
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: z.object({
            messaging_product: z.literal("whatsapp"),
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
                })
              )
              .optional(),
            messages: z.array(whatsappMessageSchema).optional(),
          }),
          field: z.literal("messages"),
        })
      ),
    })
  ),
});

/**
 * Schemas para rotas de items
 */
export const itemTypeSchema = z.enum(["movie", "video", "link", "note"]);

export const listItemsQuerySchema = z.object({
  userId: z.string().uuid(),
  type: itemTypeSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const getItemParamsSchema = z.object({
  id: z.string().uuid(),
});

export const getItemQuerySchema = z.object({
  userId: z.string().uuid(),
});

export const searchItemsBodySchema = z.object({
  userId: z.string().uuid(),
  query: z.string().min(1).max(500),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const deleteItemParamsSchema = z.object({
  id: z.string().uuid(),
});

export const deleteItemQuerySchema = z.object({
  userId: z.string().uuid(),
});

/**
 * Schemas para criação de items (interno)
 */
export const createItemSchema = z.object({
  userId: z.string().uuid(),
  type: itemTypeSchema,
  title: z.string().min(1).max(500),
  metadata: z.record(z.any()).optional(),
});

/**
 * Types inferidos dos schemas
 */
export type WebhookVerifyQuery = z.infer<typeof webhookVerifySchema>;
export type WhatsappMessage = z.infer<typeof whatsappMessageSchema>;
export type WhatsappWebhookPayload = z.infer<
  typeof whatsappWebhookPayloadSchema
>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
export type GetItemParams = z.infer<typeof getItemParamsSchema>;
export type GetItemQuery = z.infer<typeof getItemQuerySchema>;
export type SearchItemsBody = z.infer<typeof searchItemsBodySchema>;
export type DeleteItemParams = z.infer<typeof deleteItemParamsSchema>;
export type DeleteItemQuery = z.infer<typeof deleteItemQuerySchema>;
export type CreateItem = z.infer<typeof createItemSchema>;

/**
 * Schemas de resposta para Swagger
 */
export const itemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: itemTypeSchema,
  title: z.string(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.date(),
});

export const listItemsResponseSchema = z.object({
  items: z.array(itemSchema),
});

export const getItemResponseSchema = z.object({
  item: itemSchema.nullable(),
});

export const searchItemsResponseSchema = z.object({
  items: z.array(itemSchema),
});

export const deleteItemResponseSchema = z.object({
  success: z.boolean(),
});

export const errorResponseSchema = z.object({
  error: z.string(),
});

export const webhookSuccessResponseSchema = z.object({
  success: z.boolean(),
});
