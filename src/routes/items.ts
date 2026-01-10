import { Hono } from 'hono';
import { itemService } from '@/services/item-service';

export const itemsRoutes = new Hono();

/**
 * GET / - Lista items do usuário
 */
itemsRoutes.get('/', async (c) => {
	const userId = c.req.query('userId');
	const type = c.req.query('type');
	const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20;

	if (!userId) {
		return c.json({ error: 'userId é obrigatório' }, 400);
	}

	const items = await itemService.listItems({
		userId,
		type: type as any,
		limit,
	});

	return c.json({ items });
});

/**
 * GET /:id - Busca item por ID
 */
itemsRoutes.get('/:id', async (c) => {
	const userId = c.req.query('userId');
	const id = c.req.param('id');

	if (!userId) {
		return c.json({ error: 'userId é obrigatório' }, 400);
	}

	const item = await itemService.getItemById(id, userId);

	if (!item) {
		return c.json({ error: 'Item não encontrado' }, 404);
	}

	return c.json({ item });
});

/**
 * POST /search - Busca semântica
 */
itemsRoutes.post('/search', async (c) => {
	const body = await c.req.json();
	const { userId, query, limit = 20 } = body;

	if (!userId || !query) {
		return c.json({ error: 'userId e query são obrigatórios' }, 400);
	}

	const items = await itemService.searchItems({
		userId,
		query,
		limit,
	});

	return c.json({ items });
});

/**
 * DELETE /:id - Deleta item
 */
itemsRoutes.delete('/:id', async (c) => {
	const userId = c.req.query('userId');
	const id = c.req.param('id');

	if (!userId) {
		return c.json({ error: 'userId é obrigatório' }, 400);
	}

	console.log('DELETE request:', { id, userId });
	await itemService.deleteItem(id, userId);
	const response = { success: true };
	console.log('DELETE response:', response);
	return c.json(response);
});
