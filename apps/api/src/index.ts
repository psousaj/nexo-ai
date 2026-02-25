import './otel'; // OpenTelemetry must be imported first
import './sentry'; // Sentry error tracking
import { startDiscordBot } from '@/adapters/messaging/discord-adapter';
import { env } from '@/config/env';
import app from '@/server';
import { initializeLangfuse } from '@/services/langfuse'; // Langfuse AI observability
import { logger } from '@/utils/logger';
import { serve } from '@hono/node-server';
import pkg from '../package.json';

const port = env.PORT;

// Initialize Langfuse for AI observability
initializeLangfuse();

/**
 * Inicializar Baileys se a API ativa for 'baileys'
 * Necessário para receber mensagens via WebSocket
 */
async function initializeBaileysIfActive(): Promise<void> {
	try {
		const { getWhatsAppSettings } = await import('@/adapters/messaging');
		const settings = await getWhatsAppSettings();

		if (settings.activeApi === 'baileys') {
			logger.info('📱 Baileys é a API ativa, inicializando...');

			const { getBaileysService } = await import('@/services/baileys-service');
			await getBaileysService();

			logger.info('✅ Baileys inicializado e pronto para receber mensagens');
		} else {
			logger.info('📱 Meta API é a API ativa (Baileys não será inicializado)');
		}
	} catch (error) {
		logger.error({ error }, '❌ Erro ao verificar/inicializar Baileys');
	}
}

serve(
	{
		fetch: app.fetch,
		port,
	},
	async (info) => {
		// Iniciar bot do Discord se configurado
		if (env.DISCORD_BOT_TOKEN) {
			try {
				await startDiscordBot(env.DISCORD_BOT_TOKEN);
			} catch (error) {
				logger.error({ error }, '❌ Falha ao iniciar bot Discord');
			}
		}

		// Iniciar Baileys se for a API ativa do WhatsApp
		await initializeBaileysIfActive();

		logger.info(`🚀 Nexo AI rodando em http://0.0.0.0:${info.port}`);
		logger.info(`📦 Version: ${pkg.version}`);
		logger.info(`🌍 Environment: ${env.NODE_ENV}`);
		logger.info(`⚡ Runtime: ${process.versions.bun ? 'Bun' : 'Node.js'}`);
	},
);
