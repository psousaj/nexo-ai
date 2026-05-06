import { getWhatsAppSettings, invalidateWhatsAppProviderCache } from '@/adapters/messaging';
import { env } from '@/config/env';
import { getPivotFeatureFlags } from '@/config/pivot-feature-flags';
import { adminService } from '@/services/admin-service';
import { embeddingService } from '@/services/ai/embedding-service';
import { llmService } from '@/services/ai/index';
import { modelRegistryService } from '@/services/ai/model-registry';
import type { AIProviderType } from '@/services/ai/types';
import { evolutionService } from '@/services/evolution-service';
import { featureFlagService } from '@/services/feature-flag.service';
import { getSystemTools } from '@/services/tools/registry';
import { toolService } from '@/services/tools/tool.service';
import { Hono } from 'hono';

function toConnectionStatus(state?: string): 'connecting' | 'connected' | 'disconnected' | 'error' {
	const normalized = (state || '').toLowerCase();
	if (normalized === 'open' || normalized === 'connected') return 'connected';
	if (normalized === 'connecting' || normalized === 'created') return 'connecting';
	if (normalized === 'close' || normalized === 'closed' || normalized === 'disconnected') return 'disconnected';
	return 'error';
}

async function getEvolutionConnectionView(options?: {
	connectIfNeeded?: boolean;
}) {
	const stateResponse = await evolutionService.getConnectionState();
	let status = toConnectionStatus(stateResponse?.instance?.state);
	let connectError: string | null = null;

	let qrCode: string | null = null;
	let pairingCode: string | null = null;

	const shouldTryConnect = options?.connectIfNeeded && (status === 'disconnected' || status === 'error');

	if (shouldTryConnect) {
		const connectResponse = await evolutionService.connectInstance();

		if (connectResponse) {
			qrCode = connectResponse.code || null;
			pairingCode = connectResponse.pairingCode || null;
			status = 'connecting';
		} else {
			connectError = 'Instância Evolution não encontrada para iniciar conexão.';
		}
	}

	const settings = await getWhatsAppSettings();

	return {
		qrCode,
		pairingCode,
		connectionStatus: {
			status,
			phoneNumber: settings.phoneNumber || null,
			error: settings.lastError || connectError,
		},
	};
}

export const adminRoutes = new Hono()
	.get('/conversations', async (c) => {
		const conversations = await adminService.getConversationSummaries();
		return c.json(conversations);
	})
	.get('/conversations/:id/messages', async (c) => {
		const { id } = c.req.param();
		const result = await adminService.getConversationMessages(id);
		if (!result) {
			return c.json({ error: 'Conversa não encontrada' }, 404);
		}
		return c.json({ success: true, data: result });
	})
	// Discord Bot Installation Link
	.get('/discord-bot-info', async (c) => {
		return c.json({
			clientId: env.DISCORD_CLIENT_ID,
			botTokenConfigured: !!env.DISCORD_BOT_TOKEN,
			installUrl: env.DISCORD_CLIENT_ID
				? `https://discord.com/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&permissions=268445712&scope=bot%20applications.commands`
				: null,
			permissions: '268445712',
			scopes: ['bot', 'applications.commands'],
		});
	})
	.get('/pivot-feature-flags', async (c) => {
		const flags = await getPivotFeatureFlags();
		const enabled = Object.values(flags).filter(Boolean).length;
		const total = Object.keys(flags).length;

		return c.json({
			success: true,
			data: {
				flags,
				meta: { enabled, total },
			},
		});
	})
	// ========== WhatsApp Settings ==========
	.get('/whatsapp-settings', async (c) => {
		const settings = await getWhatsAppSettings();
		return c.json(settings);
	})
	.post('/whatsapp-settings/cache/clear', async (c) => {
		invalidateWhatsAppProviderCache();
		return c.json({ success: true, message: 'Cache cleared' });
	})
	.post('/whatsapp-settings/evolution/disconnect', async (c) => {
		try {
			await evolutionService.logoutInstance();
			return c.json({
				success: true,
				message: 'Sessão Evolution desconectada com sucesso',
			});
		} catch (error) {
			return c.json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Erro ao desconectar Evolution',
				},
				500,
			);
		}
	})
	// Get Evolution QR Code (compat endpoint)
	.get('/whatsapp-settings/qr-code', async (c) => {
		try {
			const view = await getEvolutionConnectionView({ connectIfNeeded: true });
			return c.json(view);
		} catch (_error) {
			return c.json(
				{
					qrCode: null,
					error: 'Evolution service not available',
				},
				503,
			);
		}
	})
	.post('/whatsapp-settings/evolution/connect', async (c) => {
		try {
			const body = await c.req.json().catch(() => ({}));
			const connectResponse = await evolutionService.connectInstance(body?.number);
			const view = await getEvolutionConnectionView({ connectIfNeeded: false });

			return c.json({
				success: true,
				pairingCode: connectResponse?.pairingCode || view.pairingCode,
				qrCode: connectResponse?.code || view.qrCode,
				connectionStatus: view.connectionStatus,
			});
		} catch (error) {
			return c.json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Erro ao conectar instância Evolution',
				},
				500,
			);
		}
	})
	.post('/whatsapp-settings/evolution/restart', async (c) => {
		try {
			await evolutionService.restartInstance();
			const view = await getEvolutionConnectionView({ connectIfNeeded: true });
			return c.json({ success: true, ...view });
		} catch (error) {
			return c.json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Erro ao reiniciar Evolution',
				},
				500,
			);
		}
	})
	// ========== Users Management ==========
	.get('/users', async (c) => {
		const users = await adminService.getAllUsersWithAccounts();
		return c.json({ success: true, data: users });
	})
	// ========== Tools Management ==========
	.get('/tools', async (c) => {
		// Get all tools from registry (system + user) with enabled status from DB
		const systemTools = getSystemTools().map((t) => ({ ...t, enabled: true }));
		const userToolsFromDb = await toolService.getAllTools();

		const allTools = [...systemTools, ...userToolsFromDb];

		// Calculate stats
		const total = allTools.length;
		const enabled = allTools.filter((t) => t.enabled).length;
		const disabled = total - enabled;
		const system = systemTools.length;

		return c.json({
			success: true,
			data: {
				tools: allTools,
				stats: {
					total,
					enabled,
					disabled,
					system,
				},
			},
		});
	})
	.patch('/tools/:toolName', async (c) => {
		const { toolName } = c.req.param();
		const { enabled } = await c.req.json();

		try {
			await toolService.updateTool(toolName as any, enabled);
			return c.json({ success: true, toolName, enabled });
		} catch (error) {
			return c.json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Erro ao atualizar tool',
				},
				400,
			);
		}
	})
	.post('/tools/enable-all', async (c) => {
		try {
			await toolService.enableAllTools();
			return c.json({ success: true });
		} catch (error) {
			return c.json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Erro ao habilitar tools',
				},
				500,
			);
		}
	})
	.post('/tools/disable-all', async (c) => {
		try {
			await toolService.disableAllTools();
			return c.json({ success: true });
		} catch (error) {
			return c.json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Erro ao desabilitar tools',
				},
				500,
			);
		}
	})
	// ========== Feature Flags (unified: pivot + channel + tool) ==========
	.get('/feature-flags', async (c) => {
		const { category } = c.req.query();
		const flags = await featureFlagService.getAll(category);

		const total = flags.length;
		const enabled = flags.filter((f) => f.enabled).length;
		const byCategory = flags.reduce(
			(acc, f) => {
				acc[f.category] = (acc[f.category] ?? 0) + 1;
				return acc;
			},
			{} as Record<string, number>,
		);

		return c.json({
			success: true,
			data: {
				flags,
				stats: { total, enabled, disabled: total - enabled, byCategory },
			},
		});
	})
	.patch('/feature-flags/:key', async (c) => {
		const key = decodeURIComponent(c.req.param('key'));
		const body = await c.req.json();
		const { enabled } = body;

		if (typeof enabled !== 'boolean') {
			return c.json({ success: false, error: '"enabled" deve ser boolean' }, 400);
		}

		try {
			await featureFlagService.update(key, enabled);
			return c.json({ success: true, key, enabled });
		} catch (error) {
			return c.json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Erro ao atualizar flag',
				},
				400,
			);
		}
	})
	// ========== Playground ==========
	.get('/playground/config', async (c) => {
		return c.json({
			success: true,
			data: {
				model: env.CF_EMBED_MODEL,
				accountId: env.CLOUDFLARE_ACCOUNT_ID ? `${env.CLOUDFLARE_ACCOUNT_ID.slice(0, 6)}...` : null,
				gatewayId: env.CLOUDFLARE_GATEWAY_ID ?? null,
				timeoutMs: env.EMBEDDING_TIMEOUT_MS ?? 25000,
				maxRetries: env.EMBEDDING_MAX_RETRIES ?? 4,
				gatewayUrl:
					env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_GATEWAY_ID
						? `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_GATEWAY_ID}/compat`
						: null,
			},
		});
	})
	.post('/playground/embedding', async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const text: string = body.text ?? '';

		if (!text.trim()) {
			return c.json({ success: false, error: 'Campo "text" é obrigatório' }, 400);
		}

		const startMs = Date.now();
		try {
			const embedding = await embeddingService.generateEmbedding(text);
			const elapsedMs = Date.now() - startMs;

			const magnitude = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
			const isZero = embedding.every((v: number) => v === 0);

			return c.json({
				success: true,
				data: {
					dimensions: embedding.length,
					magnitude: Number(magnitude.toFixed(6)),
					isZeroVector: isZero,
					elapsedMs,
					sample: {
						first5: embedding.slice(0, 5),
						last5: embedding.slice(-5),
					},
					textLength: text.length,
					model: env.CF_EMBED_MODEL,
				},
			});
		} catch (error: any) {
			const elapsedMs = Date.now() - startMs;
			return c.json(
				{
					success: false,
					elapsedMs,
					error: error instanceof Error ? error.message : String(error),
					status: error?.status ?? null,
					code: error?.code ?? null,
				},
				500,
			);
		}
	})
	.post('/playground/connectivity', async (c) => {
		const accountId = env.CLOUDFLARE_ACCOUNT_ID;
		const gatewayId = env.CLOUDFLARE_GATEWAY_ID;

		if (!accountId || !gatewayId) {
			return c.json(
				{
					success: false,
					error: 'CLOUDFLARE_ACCOUNT_ID ou CLOUDFLARE_GATEWAY_ID não configurados',
				},
				400,
			);
		}

		const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/compat`;

		const checks: Array<{
			target: string;
			url: string;
			ok: boolean;
			status?: number;
			elapsedMs: number;
			error?: string;
		}> = [];

		// Checar gateway Cloudflare
		const gateStart = Date.now();
		try {
			const res = await fetch(`${gatewayUrl}/models`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
					'Content-Type': 'application/json',
				},
				signal: AbortSignal.timeout(8000),
			});
			checks.push({
				target: 'CF AI Gateway',
				url: gatewayUrl,
				ok: res.ok,
				status: res.status,
				elapsedMs: Date.now() - gateStart,
			});
		} catch (e: any) {
			checks.push({
				target: 'CF AI Gateway',
				url: gatewayUrl,
				ok: false,
				elapsedMs: Date.now() - gateStart,
				error: e?.message ?? String(e),
			});
		}

		// Checar execução de modelo dynamic no endpoint compat
		const cfApiUrl = `${gatewayUrl}/embeddings`;
		const cfStart = Date.now();
		try {
			const res = await fetch(cfApiUrl, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: env.CF_EMBED_MODEL,
					input: 'ping',
				}),
				signal: AbortSignal.timeout(8000),
			});
			checks.push({
				target: 'CF AI Gateway dynamic (embed)',
				url: cfApiUrl,
				ok: res.ok,
				status: res.status,
				elapsedMs: Date.now() - cfStart,
			});
		} catch (e: any) {
			checks.push({
				target: 'CF AI Gateway dynamic (embed)',
				url: cfApiUrl,
				ok: false,
				elapsedMs: Date.now() - cfStart,
				error: e?.message ?? String(e),
			});
		}

		return c.json({ success: true, data: { checks } });
	})
	.post('/playground/prompt-test', async (c) => {
		try {
			const { message, tools } = await c.req.json<{
				message: string;
				tools?: string[];
			}>();
			if (!message?.trim()) {
				return c.json({ success: false, error: 'message é obrigatório' }, 400);
			}

			const { buildAgentPrompt } = await import('@/config/prompt-builder');

			const systemPrompt = buildAgentPrompt({
				assistantName: 'Nexo',
				availableTools: tools,
			}).system;
			const { message: reply } = await llmService.callLLM({
				message,
				history: [],
				systemPrompt,
			});

			return c.json({
				success: true,
				data: {
					llmResponse: reply,
					systemPrompt,
				},
			});
		} catch (error: any) {
			return c.json({ success: false, error: error?.message ?? 'Erro interno' }, 500);
		}
	})
	// ============================================================================
	// AI Provider Management (multi-provider — NEX-53)
	// ============================================================================
	.get('/ai/providers', async (c) => {
		const enabled = llmService.getEnabledProviders();
		const availability: Record<string, boolean> = {};
		for (const type of enabled) {
			const provider = llmService.getProvider(type);
			availability[type] = provider ? await provider.isAvailable() : false;
		}

		const models = await modelRegistryService.getEnabledModels();

		return c.json({
			providers: [
				{
					type: 'cloudflare',
					enabled: enabled.includes('cloudflare'),
					available: availability.cloudflare ?? false,
					label: 'Cloudflare AI Gateway',
				},
				{
					type: 'openai',
					enabled: enabled.includes('openai'),
					available: availability.openai ?? false,
					label: 'OpenAI',
				},
				{
					type: 'deepseek',
					enabled: enabled.includes('deepseek'),
					available: availability.deepseek ?? false,
					label: 'DeepSeek',
				},
			],
			models,
		});
	})
	.get('/ai/models', async (c) => {
		const provider = c.req.query('provider');
		const context = c.req.query('context');
		const q = c.req.query('q');
		const models = await modelRegistryService.searchModels({
			query: q,
			provider: provider as AIProviderType | undefined,
			contextType: context as any,
		});
		return c.json(models);
	})
	.post('/ai/models', async (c) => {
		const body = await c.req.json();
		const model = await modelRegistryService.addModel(body);
		return c.json(model, 201);
	})
	.post('/ai/models/search', async (c) => {
		const body = await c.req.json();
		const models = await modelRegistryService.searchModels({
			query: body.query,
			provider: body.provider,
			contextType: body.contextType,
		});
		return c.json(models);
	})
	.patch('/ai/models/:id', async (c) => {
		const id = Number(c.req.param('id'));
		const body = await c.req.json();
		const model = await modelRegistryService.updateModel(id, body);
		return c.json(model);
	})
	.delete('/ai/models/:id', async (c) => {
		const id = Number(c.req.param('id'));
		await modelRegistryService.removeModel(id);
		return c.json({ success: true });
	})
	.post('/ai/test/:provider', async (c) => {
		const type = c.req.param('provider') as AIProviderType;
		const provider = llmService.getProvider(type);
		if (!provider) return c.json({ available: false, error: 'Provider not configured' }, 400);
		const available = await provider.isAvailable();
		return c.json({ available, provider: type });
	});
