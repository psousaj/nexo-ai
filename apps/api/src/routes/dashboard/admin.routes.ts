import { getWhatsAppSettings, invalidateWhatsAppProviderCache, setActiveWhatsAppApi } from '@/adapters/messaging';
import { env } from '@/config/env';
import { getPivotFeatureFlags } from '@/config/pivot-feature-flags';
import { adminService } from '@/services/admin-service';
import { embeddingService } from '@/services/ai/embedding-service';
import { featureFlagService } from '@/services/feature-flag.service';
import { getSystemTools } from '@/services/tools/registry';
import { toolService } from '@/services/tools/tool.service';
import { Hono } from 'hono';

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
	.post('/whatsapp-settings/api', async (c) => {
		const { api } = await c.req.json();

		if (api !== 'meta' && api !== 'baileys') {
			return c.json({ error: 'API must be "meta" or "baileys"' }, 400);
		}

		try {
			// Se está mudando para Baileys, inicializar
			if (api === 'baileys') {
				const { getBaileysService } = await import('@/services/baileys-service');

				// Atualizar configuração no banco
				await setActiveWhatsAppApi(api);

				// Inicializar Baileys (vai começar a conectar)
				await getBaileysService();

				// Invalidar cache
				invalidateWhatsAppProviderCache();

				return c.json({
					success: true,
					activeApi: api,
					message: 'Baileys ativado e conectando. Use /admin/whatsapp-settings/qr-code para obter QR Code.',
				});
			}

			// Se está mudando para Meta, desconectar Baileys
			if (api === 'meta') {
				const { resetBaileysService } = await import('@/services/baileys-service');

				// Atualizar configuração no banco
				await setActiveWhatsAppApi(api);

				// Desconectar e limpar Baileys
				try {
					await resetBaileysService();
				} catch (error) {
					// Ignorar erro se Baileys não estava conectado
					console.warn('Baileys não estava conectado:', error);
				}

				// Invalidar cache
				invalidateWhatsAppProviderCache();

				return c.json({
					success: true,
					activeApi: api,
					message: 'Meta API ativada. Baileys desconectado.',
				});
			}

			// Fallback (nunca deveria chegar aqui devido à validação no início)
			await setActiveWhatsAppApi(api);
			invalidateWhatsAppProviderCache();

			return c.json({ success: true, activeApi: api });
		} catch (error) {
			return c.json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Erro ao alterar API',
				},
				500,
			);
		}
	})
	.post('/whatsapp-settings/cache/clear', async (c) => {
		invalidateWhatsAppProviderCache();
		return c.json({ success: true, message: 'Cache cleared' });
	})
	// Disconnect Baileys session
	.post('/whatsapp-settings/baileys/disconnect', async (c) => {
		try {
			const { resetBaileysService } = await import('@/services/baileys-service');

			// Reset the service (clears session and deletes auth files)
			await resetBaileysService();

			// Aguarda um instante para garantir que a instância foi limpa
			await new Promise((resolve) => setTimeout(resolve, 500));

			return c.json({
				success: true,
				message: 'Sessão Baileys desconectada com sucesso',
			});
		} catch (error) {
			return c.json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Erro ao desconectar Baileys',
				},
				500,
			);
		}
	})
	// Get Baileys QR Code
	.get('/whatsapp-settings/qr-code', async (c) => {
		try {
			const { getBaileysService } = await import('@/services/baileys-service');
			const baileys = await getBaileysService();
			const qrCode = await baileys.getQRCode();
			const connectionStatus = baileys.getConnectionStatus();

			return c.json({
				qrCode,
				connectionStatus,
			});
		} catch (_error) {
			return c.json(
				{
					qrCode: null,
					error: 'Baileys service not available',
				},
				503,
			);
		}
	})
	// Clear Baileys session and restart with new QR Code
	.post('/whatsapp-settings/baileys/restart', async (c) => {
		try {
			const { getBaileysService, resetBaileysService } = await import('@/services/baileys-service');

			// 1. Limpar sessão e resetar (isso deleta os arquivos de auth)
			await resetBaileysService();

			// 2. Aguardar um momento para garantir que tudo foi limpo
			await new Promise((resolve) => setTimeout(resolve, 500));

			// 3. Criar nova instância e conectar (vai gerar NOVO QR Code)
			const baileys = await getBaileysService();

			// 4. Aguardar o QR Code ser gerado
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// 5. Tentar obter o novo QR Code (pode ainda estar null)
			let attempts = 0;
			let newQRCode = await baileys.getQRCode();

			// Tentar até 5 vezes com intervalo de 500ms
			while (!newQRCode && attempts < 5) {
				await new Promise((resolve) => setTimeout(resolve, 500));
				newQRCode = await baileys.getQRCode();
				attempts++;
			}

			return c.json({
				success: true,
				message: newQRCode ? 'Sessão limpa e novo QR Code gerado com sucesso!' : 'Sessão limpa. Aguarde o QR Code aparecer.',
				qrCode: newQRCode,
			});
		} catch (error) {
			return c.json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Erro ao reiniciar Baileys',
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
					model: env.EMBEDDING_MODEL ?? '@cf/baai/bge-small-en-v1.5',
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
			return c.json({ success: false, error: 'CLOUDFLARE_ACCOUNT_ID ou CLOUDFLARE_GATEWAY_ID não configurados' }, 400);
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

		// Checar Cloudflare API diretamente
		const cfApiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-small-en-v1.5`;
		const cfStart = Date.now();
		try {
			const res = await fetch(cfApiUrl, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ text: ['ping'] }),
				signal: AbortSignal.timeout(8000),
			});
			checks.push({
				target: 'CF Workers AI (direct)',
				url: cfApiUrl,
				ok: res.ok,
				status: res.status,
				elapsedMs: Date.now() - cfStart,
			});
		} catch (e: any) {
			checks.push({
				target: 'CF Workers AI (direct)',
				url: cfApiUrl,
				ok: false,
				elapsedMs: Date.now() - cfStart,
				error: e?.message ?? String(e),
			});
		}

		return c.json({ success: true, data: { checks } });
	});
