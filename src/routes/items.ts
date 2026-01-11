import { Router, Request, Response } from 'express';
import { itemService } from '@/services/item-service';

export const itemsRouter: Router = Router();

/**
 * GET / - Lista items do usuário
 */
itemsRouter.get('/', async (req: Request, res: Response) => {
	const userId = req.query.userId as string;
	const type = req.query.type as string | undefined;
	const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

	if (!userId) {
		return res.status(400).json({ error: 'userId é obrigatório' });
	}

	const items = await itemService.listItems({
		userId,
		type: type as any,
		limit,
	});

	return res.json({ items });
});

/**
 * GET /:id - Busca item por ID
 */
itemsRouter.get('/:id', async (req: Request, res: Response) => {
	const userId = req.query.userId as string;

	if (!userId) {
		return res.status(400).json({ error: 'userId é obrigatório' });
	}

	const item = await itemService.getItemById(req.params.id as string, userId);

	if (!item) {
		return res.status(404).json({ error: 'Item não encontrado' });
	}

	return res.json({ item });
});

/**
 * POST /search - Busca semântica
 */
itemsRouter.post('/search', async (req: Request, res: Response) => {
	const { userId, query, limit = 20 } = req.body;

	if (!userId || !query) {
		return res.status(400).json({ error: 'userId e query são obrigatórios' });
	}

	const items = await itemService.searchItems({
		userId,
		query,
		limit,
	});

	return res.json({ items });
});

/**
 * DELETE /:id - Deleta item
 */
itemsRouter.delete('/:id', async (req: Request, res: Response) => {
	const userId = req.query.userId as string;

	if (!userId) {
		return res.status(400).json({ error: 'userId é obrigatório' });
	}

	console.log('DELETE request:', { params: req.params, query: req.query });
	await itemService.deleteItem(req.params.id as string, userId);
	const response = { success: true };
	console.log('DELETE response:', response);
	return res.json(response);
});
