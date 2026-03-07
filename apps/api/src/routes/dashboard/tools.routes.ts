/**
 * Tool Management Routes (Admin Only)
 *
 * Endpoints para gerenciar tools globalmente.
 * Protegidos pelo adminMiddleware aplicado em /admin/* no dashboard router.
 * ADR-019: Pluggable Tools System with CASL Protection
 */

import { toolService } from '@/services/tools/tool.service';
import { loggers } from '@/utils/logger';
import { Hono } from 'hono';
import { z } from 'zod';

const toolsRoutes = new Hono();

const updateToolSchema = z.object({
	enabled: z.boolean(),
});

/**
 * GET /api/admin/tools
 * Lista todas as tools (system + user) com status enabled/disabled
 */
toolsRoutes.get('/', async (c) => {
	try {
		const allTools = await toolService.getAllTools();

		return c.json({
			success: true,
			data: {
				tools: allTools,
				stats: {
					total: allTools.length,
					enabled: allTools.filter((t) => t.enabled).length,
					disabled: allTools.filter((t) => !t.enabled).length,
					system: allTools.filter((t) => t.category === 'system').length,
					user: allTools.filter((t) => t.category === 'user').length,
				},
			},
		});
	} catch (error) {
		loggers.api.error({ err: error }, '❌ Erro ao listar tools');
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * PATCH /api/admin/tools/:toolName
 * Habilita ou desabilita uma tool globalmente
 *
 * Body: { enabled: boolean }
 */
toolsRoutes.patch('/:toolName', async (c) => {
	try {
		const toolName = c.req.param('toolName');
		const body = await c.req.json();

		const result = updateToolSchema.safeParse(body);
		if (!result.success) {
			return c.json({ error: 'Invalid request body', details: result.error }, 400);
		}

		const { enabled } = result.data;

		await toolService.updateTool(toolName as any, enabled);

		loggers.api.info({ toolName, enabled }, '✅ Tool global atualizada');

		return c.json({
			success: true,
			message: `Tool "${toolName}" ${enabled ? 'habilitada' : 'desabilitada'} para todos os usuários`,
		});
	} catch (error) {
		loggers.api.error({ err: error }, '❌ Erro ao atualizar tool');
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * POST /api/admin/tools/enable-all
 * Habilita todas as user tools
 */
toolsRoutes.post('/enable-all', async (c) => {
	try {
		await toolService.enableAllTools();

		loggers.api.info('✅ Todas as tools habilitadas');

		return c.json({
			success: true,
			message: 'Todas as tools foram habilitadas para todos os usuários',
		});
	} catch (error) {
		loggers.api.error({ err: error }, '❌ Erro ao habilitar todas as tools');
		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * POST /api/admin/tools/disable-all
 * Desabilita todas as user tools
 */
toolsRoutes.post('/disable-all', async (c) => {
	try {
		await toolService.disableAllTools();

		loggers.api.info('❌ Todas as tools desabilitadas');

		return c.json({
			success: true,
			message: 'Todas as tools foram desabilitadas para todos os usuários',
		});
	} catch (error) {
		loggers.api.error({ err: error }, '❌ Erro ao desabilitar todas as tools');
		return c.json({ error: 'Internal server error' }, 500);
	}
});

export default toolsRoutes;
