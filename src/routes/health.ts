import { Elysia } from 'elysia';

export const healthRouter = new Elysia()
	/**
	 * GET /health - Health check
	 */
	.get(
		'/health',
		() => ({
			status: 'ok',
			timestamp: new Date().toISOString(),
		}),
		{
			detail: {
				tags: ['Health'],
				summary: 'Health check',
				description: 'Verifica se o serviço está rodando',
			},
		}
	);
