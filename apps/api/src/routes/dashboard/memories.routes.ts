import { Hono } from 'hono';
import { itemService } from '@/services/item-service';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AuthContext } from '@/types/hono';

export const memoriesRoutes = new Hono<AuthContext>()
	.get(
		'/',
		zValidator(
			'query',
			z.object({
				category: z.string().optional(),
				search: z.string().optional(),
				limit: z.string().optional(),
			}),
		),
		async (c) => {
			// userId vem do authMiddleware
			const userState = c.get('user');
			if (!userState) {
				return c.json({ error: 'Unauthorized' }, 401);
			}

			const { category, search, limit } = c.req.valid('query');

			// Se tiver search, usa searchItems
			if (search) {
				const items = await itemService.searchItems({
					userId: userState.id,
					query: search,
					limit: limit ? parseInt(limit) : 20,
				});
				return c.json(items);
			}

			// Caso contrário, lista simples (com filtro de tipo se category for tipo)
			const items = await itemService.listItems({
				userId: userState.id,
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
				type: z.enum(['movie', 'tv_show', 'video', 'link', 'note']),
				title: z.string(),
				metadata: z.any().optional(),
			}),
		),
		async (c) => {
			const userState = c.get('user');
			if (!userState) {
				return c.json({ error: 'Unauthorized' }, 401);
			}

			const data = c.req.valid('json');
			const result = await itemService.createItem({
				...data,
				userId: userState.id,
			});
			return c.json(result, 201);
		},
	)
	.patch(
		'/:id',
		zValidator(
			'json',
			z.object({
				title: z.string().optional(),
				metadata: z.any().optional(),
			}),
		),
		async (c) => {
			const userState = c.get('user');
			if (!userState) {
				return c.json({ error: 'Unauthorized' }, 401);
			}

			const id = c.req.param('id');
			const updates = c.req.valid('json');

			const item = await itemService.updateItem(id, userState.id, updates);
			if (!item) return c.json({ error: 'Not found' }, 404);

			return c.json({ success: true, item });
		},
	)
	.delete('/:id', async (c) => {
		const userState = c.get('user');
		if (!userState) {
			return c.json({ error: 'Unauthorized' }, 401);
		}

		const id = c.req.param('id');
		await itemService.deleteItem(id, userState.id);
		return c.json({ success: true });
	});
