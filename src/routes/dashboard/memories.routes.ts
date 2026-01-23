import { Hono } from 'hono';
import { itemService } from '@/services/item-service';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const memoriesRoutes = new Hono()
	.get(
		'/',
		zValidator(
			'query',
			z.object({
				userId: z.string(),
				category: z.string().optional(),
				search: z.string().optional(),
				limit: z.string().optional(),
			}),
		),
		async (c) => {
			const { userId, category, search, limit } = c.req.valid('query');

			// Se tiver search, usa searchItems
			if (search) {
				const items = await itemService.searchItems({
					userId,
					query: search,
					limit: limit ? parseInt(limit) : 20,
				});
				return c.json(items);
			}

			// Caso contrário, lista simples (com filtro de tipo se category for tipo)
			const items = await itemService.listItems({
				userId,
				type: category as any,
				limit: limit ? parseInt(limit) : 20,
			});

			return c.json(items);
		},
	)
	.post(
		'/',
		zValidator(
			'json',
			z.object({
				userId: z.string(),
				type: z.enum(['movie', 'tv_show', 'video', 'link', 'note']),
				title: z.string(),
				metadata: z.any().optional(),
			}),
		),
		async (c) => {
			const data = c.req.valid('json');
			const result = await itemService.createItem(data);
			return c.json(result, 201);
		},
	)
	.patch(
		'/:id',
		zValidator(
			'json',
			z.object({
				userId: z.string(),
				title: z.string().optional(),
				metadata: z.any().optional(),
			}),
		),
		async (c) => {
			const id = c.req.param('id');
			const { userId, ...updates } = c.req.valid('json');

			const item = await itemService.updateItem(id, userId, updates);
			if (!item) return c.json({ error: 'Not found' }, 404);

			return c.json({ success: true, item });
		},
	)
	.delete(
		'/:id',
		zValidator(
			'query',
			z.object({
				userId: z.string(),
			}),
		),
		async (c) => {
			const id = c.req.param('id');
			const { userId } = c.req.valid('query');
			await itemService.deleteItem(id, userId);
			return c.json({ success: true });
		},
	);
