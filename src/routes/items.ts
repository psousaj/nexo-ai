import { Elysia, t } from 'elysia';
import { itemService } from '@/services/item-service';
import { logger } from '@/utils/logger';

export const itemsRouter = new Elysia()
	/**
	 * GET / - Lista items do usuário
	 */
	.get(
		'/',
		async ({ query, set }) => {
			const { userId, type, limit } = query;

			if (!userId) {
				set.status = 400;
				return { error: 'userId é obrigatório' };
			}

			const items = await itemService.listItems({
				userId,
				type: type as any,
				limit: limit ? parseInt(limit) : 20,
			});

			return { items };
		},
		{
			query: t.Object({
				userId: t.String({ description: 'ID do usuário' }),
				type: t.Optional(t.String({ description: 'Tipo de item (movie, tv_show, video, link, note)' })),
				limit: t.Optional(t.String({ description: 'Limite de resultados' })),
			}),
			detail: {
				tags: ['Items'],
				summary: 'Listar items',
				description: 'Lista todos os items do usuário com filtros opcionais',
			},
		}
	)

	/**
	 * GET /:id - Busca item por ID
	 */
	.get(
		'/:id',
		async ({ params, query, set }) => {
			const { userId } = query;

			if (!userId) {
				set.status = 400;
				return { error: 'userId é obrigatório' };
			}

			const item = await itemService.getItemById(params.id, userId);

			if (!item) {
				set.status = 404;
				return { error: 'Item não encontrado' };
			}

			return { item };
		},
		{
			params: t.Object({ id: t.String({ description: 'ID do item' }) }),
			query: t.Object({ userId: t.String({ description: 'ID do usuário' }) }),
			detail: {
				tags: ['Items'],
				summary: 'Buscar item por ID',
				description: 'Retorna um item específico do usuário',
			},
		}
	)

	/**
	 * POST /search - Busca semântica
	 */
	.post(
		'/search',
		async ({ body, set }) => {
			const { userId, query, limit = 20 } = body;

			if (!userId || !query) {
				set.status = 400;
				return { error: 'userId e query são obrigatórios' };
			}

			const items = await itemService.searchItems({
				userId,
				query,
				limit,
			});

			return { items };
		},
		{
			body: t.Object({
				userId: t.String({ description: 'ID do usuário' }),
				query: t.String({ description: 'Texto de busca' }),
				limit: t.Optional(t.Number({ description: 'Limite de resultados', default: 20 })),
			}),
			detail: {
				tags: ['Items'],
				summary: 'Buscar items',
				description: 'Busca semântica nos items do usuário',
			},
		}
	)

	/**
	 * DELETE /:id - Deleta item
	 */
	.delete(
		'/:id',
		async ({ params, query, set }) => {
			const { userId } = query;

			if (!userId) {
				set.status = 400;
				return { error: 'userId é obrigatório' };
			}

			logger.info({ params, query }, '🗑️ DELETE request');
			await itemService.deleteItem(params.id, userId);
			const response = { success: true };
			logger.info(response, '✅ DELETE response');
			return response;
		},
		{
			params: t.Object({ id: t.String({ description: 'ID do item' }) }),
			query: t.Object({ userId: t.String({ description: 'ID do usuário' }) }),
			detail: {
				tags: ['Items'],
				summary: 'Deletar item',
				description: 'Remove um item da biblioteca do usuário',
			},
		}
	);
