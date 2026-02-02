import { z } from 'zod';

export const itemTypeSchema = z.enum(['movie', 'tv_show', 'video', 'link', 'note']);

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

export const createItemSchema = z.object({
	userId: z.string().uuid(),
	type: itemTypeSchema,
	title: z.string().min(1).max(500),
	metadata: z.record(z.any()).optional(),
});

export const itemSchema = z.object({
	id: z.string().uuid(),
	userId: z.string().uuid(),
	type: itemTypeSchema,
	title: z.string(),
	metadata: z.record(z.any()).nullable(),
	createdAt: z.date(),
});

// Response schemas
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

// Inferred types based on schemas
export type ItemType = z.infer<typeof itemTypeSchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
export type GetItemParams = z.infer<typeof getItemParamsSchema>;
export type GetItemQuery = z.infer<typeof getItemQuerySchema>;
export type SearchItemsBody = z.infer<typeof searchItemsBodySchema>;
export type DeleteItemParams = z.infer<typeof deleteItemParamsSchema>;
export type DeleteItemQuery = z.infer<typeof deleteItemQuerySchema>;
export type CreateItem = z.infer<typeof createItemSchema>;
// export type Item = z.infer<typeof itemSchema>; // Use ItemMetadata instead where possible for better typing?
