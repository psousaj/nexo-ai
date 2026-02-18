import { adminService } from '@/services/admin-service';
import { toolService } from '@/services/tools/tool.service';
import { getSystemTools, getAllTools } from '@/services/tools/registry';
import { getWhatsAppSettings, setActiveWhatsAppApi, invalidateWhatsAppProviderCache } from '@/adapters/messaging';
import { env } from '@/config/env';
import { Hono } from 'hono';

export const adminRoutes = new Hono()
	.get('/errors', async (c) => {
		const errors = await adminService.getErrorReports();
		return c.json(errors);
	})
	.get('/conversations', async (c) => {
		const conversations = await adminService.getConversationSummaries();
		return c.json(conversations);
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
					message: 'Baileys ativado e conectando. Use /admin/whatsapp-settings/qr-code para obter QR Code.'
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
					message: 'Meta API ativada. Baileys desconectado.'
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
				500
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
			const { getBaileysService } = await import('@/services/baileys-service');
			const baileys = await getBaileysService();

			// Disconnect the session
			await baileys.disconnect();

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
		} catch (error) {
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
			await new Promise(resolve => setTimeout(resolve, 500));

			// 3. Criar nova instância e conectar (vai gerar NOVO QR Code)
			const baileys = await getBaileysService();

			// 4. Aguardar o QR Code ser gerado
			await new Promise(resolve => setTimeout(resolve, 1000));

			// 5. Tentar obter o novo QR Code (pode ainda estar null)
			let attempts = 0;
			let newQRCode = await baileys.getQRCode();

			// Tentar até 5 vezes com intervalo de 500ms
			while (!newQRCode && attempts < 5) {
				await new Promise(resolve => setTimeout(resolve, 500));
				newQRCode = await baileys.getQRCode();
				attempts++;
			}

			return c.json({
				success: true,
				message: newQRCode
					? 'Sessão limpa e novo QR Code gerado com sucesso!'
					: 'Sessão limpa. Aguarde o QR Code aparecer.',
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
	});
