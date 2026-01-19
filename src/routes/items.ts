import { Hono } from 'hono';
import { itemService } from '@/services/item-service';
import { logger } from '@/utils/logger';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const itemsRouter = new Hono()
	/**
	 * GET / - Lista items do usuário
	 */
	.get(
		'/',
		zValidator(
			'query',
			z.object({
				userId: z.string(),
				type: z.string().optional(),
				limit: z.string().optional(),
			})
		),
		async (c) => {
			const { userId, type, limit } = c.req.valid('query');

			const items = await itemService.listItems({
				userId,
				type: type as any,
				limit: limit ? parseInt(limit) : 20,
			});

			return c.json({ items });
		}
	)

	/**
	 * GET /:id - Busca item por ID
	 */
	.get(
		'/:id',
		zValidator(
			'query',
			z.object({
				userId: z.string(),
			})
		),
		async (c) => {
			const { userId } = c.req.valid('query');
			const id = c.req.param('id');

			const item = await itemService.getItemById(id, userId);

			if (!item) {
				return c.json({ error: 'Item não encontrado' }, 404);
			}

			return c.json({ item });
		}
	)

	/**
	 * POST /search - Busca semântica
	 */
	.post(
		'/search',
		zValidator(
			'json',
			z.object({
				userId: z.string(),
				query: z.string(),
				limit: z.number().optional().default(20),
			})
		),
		async (c) => {
			const { userId, query, limit } = c.req.valid('json');

			const items = await itemService.searchItems({
				userId,
				query,
				limit,
			});

			return c.json({ items });
		}
	)

	/**
	 * DELETE /:id - Deleta item
	 */
	.delete(
		'/:id',
		zValidator(
			'query',
			z.object({
				userId: z.string(),
			})
		),
		async (c) => {
			const { userId } = c.req.valid('query');
			const id = c.req.param('id');

			logger.info({ id, userId }, '🗑️ DELETE request');
			await itemService.deleteItem(id, userId);
			const response = { success: true };
			logger.info(response, '✅ DELETE response');
			return c.json(response);
		}
	);
