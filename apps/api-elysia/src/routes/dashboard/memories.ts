import { itemService } from '@nexo/api-core/services/item-service';
import Elysia, { t } from 'elysia';
import { betterAuthPlugin } from '@/plugins/better-auth';

export const memoriesRoutes = new Elysia({ prefix: '/memories' })
	.use(betterAuthPlugin)
	.get(
		'/',
		async ({ user, query }) => {
			const { category, search, limit } = query;

			if (search) {
				const items = await itemService.searchItems({
					userId: user.id,
					query: search,
					limit: limit ? Number.parseInt(limit) : 20,
				});
				return items;
			}

			const items = await itemService.listItems({
				userId: user.id,
				type: category as any,
				limit: limit ? Number.parseInt(limit) : 20,
			});

			return items;
		},
		{
			auth: true,
			query: t.Object({
				category: t.Optional(t.String()),
				search: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	)
	.post(
		'/',
		async ({ user, body, set }) => {
			const result = await itemService.createItem({ ...body, userId: user.id });
			set.status = 201;
			return result;
		},
		{
			auth: true,
			body: t.Object({
				type: t.Union([t.Literal('movie'), t.Literal('tv_show'), t.Literal('video'), t.Literal('link'), t.Literal('note')]),
				title: t.String(),
				metadata: t.Optional(t.Any()),
			}),
		},
	)
	.patch(
		'/:id',
		async ({ user, params, body, set }) => {
			const item = await itemService.updateItem(params.id, user.id, body);
			if (!item) {
				set.status = 404;
				return { error: 'Not found' };
			}
			return { success: true, item };
		},
		{
			auth: true,
			body: t.Object({
				title: t.Optional(t.String()),
				metadata: t.Optional(t.Any()),
			}),
		},
	)
	.delete(
		'/:id',
		async ({ user, params }) => {
			await itemService.deleteItem(params.id, user.id);
			return { success: true };
		},
		{ auth: true },
	);
