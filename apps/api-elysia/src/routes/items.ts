import { itemService } from '@nexo/api-core/services/item-service';
import { logger } from '@nexo/api-core/utils/logger';
import Elysia, { t } from 'elysia';

export const itemsRouter = new Elysia({ prefix: '/items' })
	/**
	 * GET / - Lista items do usuário
	 */
	.get(
		'/',
		async ({ query }) => {
			const { userId, type, limit } = query;
			const items = await itemService.listItems({
				userId,
				type: type as any,
				limit: limit ? Number.parseInt(limit) : 20,
			});
			return { items };
		},
		{
			query: t.Object({
				userId: t.String(),
				type: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	)

	/**
	 * GET /:id - Busca item por ID
	 */
	.get(
		'/:id',
		async ({ params, query, set }) => {
			const { id } = params;
			const { userId } = query;
			const item = await itemService.getItemById(id, userId);
			if (!item) {
				set.status = 404;
				return { error: 'Item não encontrado' };
			}
			return { item };
		},
		{
			query: t.Object({ userId: t.String() }),
		},
	)

	/**
	 * POST /search - Busca semântica
	 */
	.post(
		'/search',
		async ({ body }) => {
			const { userId, query, limit } = body;
			const items = await itemService.searchItems({ userId, query, limit: limit ?? 20 });
			return { items };
		},
		{
			body: t.Object({
				userId: t.String(),
				query: t.String(),
				limit: t.Optional(t.Number({ default: 20 })),
			}),
		},
	)

	/**
	 * DELETE /:id - Deleta item
	 */
	.delete(
		'/:id',
		async ({ params, query }) => {
			const { id } = params;
			const { userId } = query;
			logger.info({ id, userId }, '🗑️ DELETE request');
			await itemService.deleteItem(id, userId);
			return { success: true };
		},
		{
			query: t.Object({ userId: t.String() }),
		},
	);
