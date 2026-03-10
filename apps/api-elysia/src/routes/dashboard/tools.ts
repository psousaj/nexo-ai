/**
 * Tool Management Routes (Admin Only)
 * ADR-019: Pluggable Tools System with CASL Protection
 */
import { toolAvailabilityService } from '@nexo/api-core/services/tool-availability.service';
import { getAllTools } from '@nexo/api-core/services/tools/registry';
import { toolService } from '@nexo/api-core/services/tools/tool.service';
import { loggers } from '@nexo/api-core/utils/logger';
import Elysia, { t } from 'elysia';
import { betterAuthPlugin } from '@/plugins/better-auth';

export const toolsRoutes = new Elysia({ prefix: '/admin/tools' })
	.use(betterAuthPlugin)

	/**
	 * GET /api/admin/tools
	 * Lista todas as tools (system + user) com status enabled/disabled
	 */
	.get(
		'/',
		async ({ set }) => {
			try {
				const allTools = await toolService.getAllTools();
				const registryTools = getAllTools();
				const registryMap = new Map(registryTools.map((tool) => [tool.name, tool]));
				const toolsWithMeta = allTools.map((tool) => ({
					...tool,
					comingSoon: registryMap.get(tool.name)?.defaultEnabled === false,
				}));

				return {
					success: true,
					data: {
						tools: toolsWithMeta,
						stats: {
							total: toolsWithMeta.length,
							enabled: toolsWithMeta.filter((tool) => tool.enabled).length,
							disabled: toolsWithMeta.filter((tool) => !tool.enabled).length,
							system: toolsWithMeta.filter((tool) => tool.category === 'system').length,
							user: toolsWithMeta.filter((tool) => tool.category === 'user').length,
						},
					},
				};
			} catch (err) {
				loggers.api.error({ err }, '❌ Erro ao listar tools');
				set.status = 500;
				return { error: 'Internal server error' };
			}
		},
		{ adminAuth: true },
	)

	/**
	 * PATCH /api/admin/tools/:toolName
	 * Habilita ou desabilita uma tool globalmente
	 */
	.patch(
		'/:toolName',
		async ({ params, body, set }) => {
			try {
				await toolService.updateTool(params.toolName as any, body.enabled);
				await toolAvailabilityService.invalidateCache();
				loggers.api.info({ toolName: params.toolName, enabled: body.enabled }, '✅ Tool global atualizada');
				return { success: true, toolName: params.toolName, enabled: body.enabled };
			} catch (err) {
				loggers.api.error({ err, toolName: params.toolName }, '❌ Erro ao atualizar tool');
				set.status = 500;
				return { error: 'Internal server error' };
			}
		},
		{
			adminAuth: true,
			body: t.Object({ enabled: t.Boolean() }),
		},
	);
