/**
 * Tool Management Routes (Admin Only)
 *
 * Endpoints para gerenciar tools globalmente (CASL protected)
 * ADR-019: Pluggable Tools System with CASL Protection
 */

import { toolService } from '@/services/tools/tool.service';
import { loggers } from '@/utils/logger';
import { Hono } from 'hono';
import { z } from 'zod';

const toolsRoutes = new Hono();

/**
 * Schema de validação
 */
const updateToolSchema = z.object({
	enabled: z.boolean(),
});

/**
 * GET /api/admin/tools
 * Lista todas as tools (system + user) com status enabled/disabled
 *
 * CASL: Requer permissão 'manage' no subject 'AdminPanel'
 */
toolsRoutes.get('/', async (c) => {
	try {
		// TODO: Adicionar middleware CASL
		// const ability = c.get('ability');
		// if (!ability.can('manage', 'AdminPanel')) {
		//   return c.json({ error: 'Forbidden' }, 403);
		// }

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
 * Atualiza status de tool global
 *
 * Body: { enabled: boolean }
 *
 * CASL: Requer permissão 'manage' no subject 'AdminPanel'
 */
toolsRoutes.patch('/:toolName', async (c) => {
	try {
		// TODO: Adicionar middleware CASL
		// const ability = c.get('ability');
		// if (!ability.can('manage', 'AdminPanel')) {
		//   return c.json({ error: 'Forbidden' }, 403);
		// }

		const toolName = c.req.param('toolName');
		const body = await c.req.json();

		// Validar body
		const result = updateToolSchema.safeParse(body);
		if (!result.success) {
			return c.json({ error: 'Invalid request body', details: result.error }, 400);
		}

		const { enabled } = result.data;

		// Atualizar tool
		await toolService.updateTool(toolName as any, enabled);

		loggers.api.info({ toolName, enabled }, '✅ Tool global atualizada');

		return c.json({
			success: true,
			message: `Tool "${toolName}" ${enabled ? 'habilitada' : 'desabilitada'} para todos os usuários`,
		});
	} catch (error) {
		loggers.api.error({ err: error }, '❌ Erro ao atualizar tool');

		if (error instanceof Error && error.message.includes('System tools')) {
			return c.json({ error: error.message }, 400);
		}

		return c.json({ error: 'Internal server error' }, 500);
	}
});

/**
 * POST /api/admin/tools/enable-all
 * Habilita todas as user tools
 *
 * CASL: Requer permissão 'manage' no subject 'AdminPanel'
 */
toolsRoutes.post('/enable-all', async (c) => {
	try {
		// TODO: Adicionar middleware CASL
		// const ability = c.get('ability');
		// if (!ability.can('manage', 'AdminPanel')) {
		//   return c.json({ error: 'Forbidden' }, 403);
		// }

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
 *
 * CASL: Requer permissão 'manage' no subject 'AdminPanel'
 */
toolsRoutes.post('/disable-all', async (c) => {
	try {
		// TODO: Adicionar middleware CASL
		// const ability = c.get('ability');
		// if (!ability.can('manage', 'AdminPanel')) {
		//   return c.json({ error: 'Forbidden' }, 403);
		// }

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
