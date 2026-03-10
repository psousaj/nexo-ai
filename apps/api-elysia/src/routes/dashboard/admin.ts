import { getWhatsAppSettings, invalidateWhatsAppProviderCache, setActiveWhatsAppApi } from '@nexo/api-core/adapters/messaging';
import { env } from '@nexo/api-core/config/env';
import { getPivotFeatureFlags } from '@nexo/api-core/config/pivot-feature-flags';
import { adminService } from '@nexo/api-core/services/admin-service';
import { embeddingService } from '@nexo/api-core/services/ai/embedding-service';
import { featureFlagService } from '@nexo/api-core/services/feature-flag.service';
import { getSystemTools } from '@nexo/api-core/services/tools/registry';
import { toolService } from '@nexo/api-core/services/tools/tool.service';
import { loggers } from '@nexo/api-core/utils/logger';
import Elysia, { t } from 'elysia';
import { betterAuthPlugin } from '@/plugins/better-auth';

export const adminRoutes = new Elysia({ prefix: '/admin' })
	.use(betterAuthPlugin)

	// Conversations
	.get(
		'/conversations',
		async () => {
			const conversations = await adminService.getConversationSummaries();
			return conversations;
		},
		{ adminAuth: true },
	)

	.get(
		'/conversations/:id/messages',
		async ({ params, set }) => {
			const result = await adminService.getConversationMessages(params.id);
			if (!result) {
				set.status = 404;
				return { error: 'Conversa não encontrada' };
			}
			return { success: true, data: result };
		},
		{ adminAuth: true },
	)

	// Discord Bot info
	.get(
		'/discord-bot-info',
		() => ({
			clientId: env.DISCORD_CLIENT_ID,
			botTokenConfigured: !!env.DISCORD_BOT_TOKEN,
			installUrl: env.DISCORD_CLIENT_ID
				? `https://discord.com/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&permissions=268445712&scope=bot%20applications.commands`
				: null,
			permissions: '268445712',
			scopes: ['bot', 'applications.commands'],
		}),
		{ adminAuth: true },
	)

	// Pivot feature flags (legacy)
	.get(
		'/pivot-feature-flags',
		async () => {
			const flags = await getPivotFeatureFlags();
			const enabled = Object.values(flags).filter(Boolean).length;
			const total = Object.keys(flags).length;
			return { success: true, data: { flags, meta: { enabled, total } } };
		},
		{ adminAuth: true },
	)

	// =========================================================================
	// WhatsApp Settings
	// =========================================================================
	.get(
		'/whatsapp-settings',
		async () => {
			const settings = await getWhatsAppSettings();
			return settings;
		},
		{ adminAuth: true },
	)

	.post(
		'/whatsapp-settings/api',
		async ({ body, set }) => {
			const { api } = body;
			if (api !== 'meta' && api !== 'baileys') {
				set.status = 400;
				return { error: 'API must be "meta" or "baileys"' };
			}

			try {
				if (api === 'baileys') {
					const { getBaileysService } = await import('@nexo/api-core/services/baileys-service');
					await setActiveWhatsAppApi(api);
					await getBaileysService();
					invalidateWhatsAppProviderCache();
					return {
						success: true,
						activeApi: api,
						message: 'Baileys ativado e conectando. Use /admin/whatsapp-settings/qr-code para obter QR Code.',
					};
				}

				if (api === 'meta') {
					const { resetBaileysService } = await import('@nexo/api-core/services/baileys-service');
					await setActiveWhatsAppApi(api);
					try {
						await resetBaileysService();
					} catch {
						/* not connected */
					}
					invalidateWhatsAppProviderCache();
					return { success: true, activeApi: api, message: 'Meta API ativada. Baileys desconectado.' };
				}

				await setActiveWhatsAppApi(api as any);
				invalidateWhatsAppProviderCache();
				return { success: true, activeApi: api };
			} catch (err) {
				set.status = 500;
				return { success: false, error: err instanceof Error ? err.message : 'Erro ao alterar API' };
			}
		},
		{
			adminAuth: true,
			body: t.Object({ api: t.String() }),
		},
	)

	.post(
		'/whatsapp-settings/cache/clear',
		() => {
			invalidateWhatsAppProviderCache();
			return { success: true, message: 'Cache cleared' };
		},
		{ adminAuth: true },
	)

	.post(
		'/whatsapp-settings/baileys/disconnect',
		async ({ set }) => {
			try {
				const { resetBaileysService } = await import('@nexo/api-core/services/baileys-service');
				await resetBaileysService();
				await new Promise((resolve) => setTimeout(resolve, 500));
				return { success: true, message: 'Sessão Baileys desconectada com sucesso' };
			} catch (err) {
				set.status = 500;
				return { success: false, error: err instanceof Error ? err.message : 'Erro ao desconectar Baileys' };
			}
		},
		{ adminAuth: true },
	)

	.get(
		'/whatsapp-settings/qr-code',
		async ({ set }) => {
			try {
				const { getBaileysService } = await import('@nexo/api-core/services/baileys-service');
				const baileys = await getBaileysService();
				const qrCode = await baileys.getQRCode();
				const connectionStatus = baileys.getConnectionStatus();
				return { qrCode, connectionStatus };
			} catch {
				set.status = 503;
				return { qrCode: null, error: 'Baileys service not available' };
			}
		},
		{ adminAuth: true },
	)

	.post(
		'/whatsapp-settings/baileys/restart',
		async ({ set }) => {
			try {
				const { getBaileysService, resetBaileysService } = await import('@nexo/api-core/services/baileys-service');
				await resetBaileysService();
				await new Promise((resolve) => setTimeout(resolve, 500));
				const baileys = await getBaileysService();
				await new Promise((resolve) => setTimeout(resolve, 1000));

				let attempts = 0;
				let newQRCode = await baileys.getQRCode();
				while (!newQRCode && attempts < 5) {
					await new Promise((resolve) => setTimeout(resolve, 500));
					newQRCode = await baileys.getQRCode();
					attempts++;
				}

				return {
					success: true,
					message: newQRCode ? 'Sessão limpa e novo QR Code gerado com sucesso!' : 'Sessão limpa. Aguarde o QR Code aparecer.',
					qrCode: newQRCode,
				};
			} catch (err) {
				set.status = 500;
				return { success: false, error: err instanceof Error ? err.message : 'Erro ao reiniciar Baileys' };
			}
		},
		{ adminAuth: true },
	)

	// =========================================================================
	// Users Management
	// =========================================================================
	.get(
		'/users',
		async () => {
			const users = await adminService.getAllUsersWithAccounts();
			return { success: true, data: users };
		},
		{ adminAuth: true },
	)

	// =========================================================================
	// Tools Management
	// =========================================================================
	.get(
		'/tools',
		async () => {
			const systemTools = getSystemTools().map((tool) => ({ ...tool, enabled: true }));
			const userToolsFromDb = await toolService.getAllTools();
			const allTools = [...systemTools, ...userToolsFromDb];

			const total = allTools.length;
			const enabled = allTools.filter((tool) => tool.enabled).length;

			return {
				success: true,
				data: {
					tools: allTools,
					stats: { total, enabled, disabled: total - enabled, system: systemTools.length },
				},
			};
		},
		{ adminAuth: true },
	)

	.patch(
		'/tools/:toolName',
		async ({ params, body, set }) => {
			try {
				await toolService.updateTool(params.toolName as any, body.enabled);
				return { success: true, toolName: params.toolName, enabled: body.enabled };
			} catch (err) {
				set.status = 400;
				return { success: false, error: err instanceof Error ? err.message : 'Erro ao atualizar tool' };
			}
		},
		{
			adminAuth: true,
			body: t.Object({ enabled: t.Boolean() }),
		},
	)

	.post(
		'/tools/enable-all',
		async ({ set }) => {
			try {
				await toolService.enableAllTools();
				return { success: true };
			} catch (err) {
				set.status = 500;
				return { success: false, error: err instanceof Error ? err.message : 'Erro ao habilitar tools' };
			}
		},
		{ adminAuth: true },
	)

	.post(
		'/tools/disable-all',
		async ({ set }) => {
			try {
				await toolService.disableAllTools();
				return { success: true };
			} catch (err) {
				set.status = 500;
				return { success: false, error: err instanceof Error ? err.message : 'Erro ao desabilitar tools' };
			}
		},
		{ adminAuth: true },
	)

	// =========================================================================
	// Feature Flags
	// =========================================================================
	.get(
		'/feature-flags',
		async ({ query }) => {
			const flags = await featureFlagService.getAll(query?.category as string | undefined);
			const total = flags.length;
			const enabled = flags.filter((f: any) => f.enabled).length;
			const byCategory = flags.reduce((acc: Record<string, number>, f: any) => {
				acc[f.category] = (acc[f.category] ?? 0) + 1;
				return acc;
			}, {});

			return { success: true, data: { flags, stats: { total, enabled, disabled: total - enabled, byCategory } } };
		},
		{ adminAuth: true },
	)

	.patch(
		'/feature-flags/:key',
		async ({ params, body, set }) => {
			const key = decodeURIComponent(params.key);
			const { enabled } = body;

			if (typeof enabled !== 'boolean') {
				set.status = 400;
				return { success: false, error: '"enabled" deve ser boolean' };
			}

			try {
				await featureFlagService.update(key, enabled);
				return { success: true, key, enabled };
			} catch (err) {
				set.status = 400;
				return { success: false, error: err instanceof Error ? err.message : 'Erro ao atualizar flag' };
			}
		},
		{
			adminAuth: true,
			body: t.Object({ enabled: t.Any() }),
		},
	)

	// =========================================================================
	// Playground
	// =========================================================================
	.get(
		'/playground/config',
		() => ({
			success: true,
			data: {
				model: env.EMBEDDING_MODEL ?? '@cf/baai/bge-small-en-v1.5',
				accountId: env.CLOUDFLARE_ACCOUNT_ID ? `${env.CLOUDFLARE_ACCOUNT_ID.slice(0, 6)}...` : null,
				gatewayId: env.CLOUDFLARE_GATEWAY_ID ?? null,
				timeoutMs: env.EMBEDDING_TIMEOUT_MS ?? 25000,
				maxRetries: env.EMBEDDING_MAX_RETRIES ?? 4,
				gatewayUrl:
					env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_GATEWAY_ID
						? `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_GATEWAY_ID}/compat`
						: null,
			},
		}),
		{ adminAuth: true },
	)

	.post(
		'/playground/embedding',
		async ({ body, set }) => {
			const text: string = (body as any)?.text ?? '';
			if (!text.trim()) {
				set.status = 400;
				return { success: false, error: 'Campo "text" é obrigatório' };
			}

			const startMs = Date.now();
			try {
				const embedding = await embeddingService.generateEmbedding(text);
				const elapsedMs = Date.now() - startMs;
				const magnitude = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));

				return {
					success: true,
					data: {
						dimensions: embedding.length,
						magnitude: Number(magnitude.toFixed(6)),
						isZeroVector: embedding.every((v: number) => v === 0),
						elapsedMs,
						sample: { first5: embedding.slice(0, 5), last5: embedding.slice(-5) },
						textLength: text.length,
						model: env.EMBEDDING_MODEL ?? '@cf/baai/bge-small-en-v1.5',
					},
				};
			} catch (err: any) {
				set.status = 500;
				return {
					success: false,
					elapsedMs: Date.now() - startMs,
					error: err instanceof Error ? err.message : String(err),
					status: err?.status ?? null,
					code: err?.code ?? null,
				};
			}
		},
		{ adminAuth: true },
	)

	.post(
		'/playground/connectivity',
		async ({ set }) => {
			const accountId = env.CLOUDFLARE_ACCOUNT_ID;
			const gatewayId = env.CLOUDFLARE_GATEWAY_ID;

			if (!accountId || !gatewayId) {
				set.status = 400;
				return { success: false, error: 'CLOUDFLARE_ACCOUNT_ID ou CLOUDFLARE_GATEWAY_ID não configurados' };
			}

			const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/compat`;
			const checks: any[] = [];

			const gateStart = Date.now();
			try {
				const res = await fetch(`${gatewayUrl}/models`, {
					method: 'GET',
					headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
					signal: AbortSignal.timeout(8000),
				});
				checks.push({ target: 'CF AI Gateway', url: gatewayUrl, ok: res.ok, status: res.status, elapsedMs: Date.now() - gateStart });
			} catch (e: any) {
				checks.push({ target: 'CF AI Gateway', url: gatewayUrl, ok: false, elapsedMs: Date.now() - gateStart, error: e?.message });
			}

			const cfApiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-small-en-v1.5`;
			const cfStart = Date.now();
			try {
				const res = await fetch(cfApiUrl, {
					method: 'POST',
					headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ text: ['ping'] }),
					signal: AbortSignal.timeout(8000),
				});
				checks.push({ target: 'CF Workers AI (direct)', url: cfApiUrl, ok: res.ok, status: res.status, elapsedMs: Date.now() - cfStart });
			} catch (e: any) {
				checks.push({ target: 'CF Workers AI (direct)', url: cfApiUrl, ok: false, elapsedMs: Date.now() - cfStart, error: e?.message });
			}

			return { success: true, data: { checks } };
		},
		{ adminAuth: true },
	)

	.post(
		'/playground/prompt-test',
		async ({ body, set }) => {
			try {
				const { message, tools } = body as { message: string; tools?: string[] };
				if (!message?.trim()) {
					set.status = 400;
					return { success: false, error: 'message é obrigatório' };
				}

				const { getAgentSystemPrompt } = await import('@nexo/api-core/config/prompts');
				const { llmService } = await import('@nexo/api-core/services/ai');

				const systemPrompt = getAgentSystemPrompt('Nexo', tools);
				const llmResponse = await llmService.callLLM({ message, history: [], systemPrompt });

				return {
					success: true,
					data: {
						llmResponse: typeof llmResponse === 'string' ? llmResponse : JSON.stringify(llmResponse, null, 2),
						systemPrompt,
					},
				};
			} catch (err: any) {
				set.status = 500;
				return { success: false, error: err?.message ?? 'Erro interno' };
			}
		},
		{ adminAuth: true },
	);
