import './otel'; // OpenTelemetry must be imported first
import './sentry'; // Sentry error tracking
import { startDiscordBot } from '@/adapters/messaging/discord-adapter';
import { env } from '@/config/env';
import app from '@/server';
import { globalErrorHandler } from '@/services/error/error.service';
import { initializeLangfuse, shutdownLangfuse } from '@/services/langfuse'; // Langfuse AI observability
import { shutdownSentry } from '@/sentry';
import { logger } from '@/utils/logger';
import { serve } from '@hono/node-server';
import pkg from '../package.json';

const port = env.PORT;

process.on('unhandledRejection', async (reason) => {
	await globalErrorHandler.handle(reason instanceof Error ? reason : new Error(String(reason)), {
		provider: 'process',
		state: 'unhandled_rejection',
		extra: {
			reason: reason instanceof Error ? reason.message : String(reason),
		},
	});
});

process.on('uncaughtException', async (error) => {
	await globalErrorHandler.handle(error, {
		provider: 'process',
		state: 'uncaught_exception',
	});
});

process.on('warning', async (warning) => {
	await globalErrorHandler.handle(warning, {
		provider: 'process',
		state: 'runtime_warning',
		extra: {
			name: warning.name,
			message: warning.message,
		},
	});
});

// Initialize Langfuse for AI observability
initializeLangfuse();

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
	if (isShuttingDown) return;
	isShuttingDown = true;

	logger.info({ signal }, '🛑 Encerrando aplicação (graceful shutdown)');

	try {
		await shutdownLangfuse();
		await shutdownSentry();
		logger.info('✅ Shutdown de observabilidade concluído');
	} catch (error) {
		logger.error({ error }, '❌ Erro durante graceful shutdown');
	} finally {
		process.exit(0);
	}
}

process.on('SIGINT', () => {
	void gracefulShutdown('SIGINT');
});

process.on('SIGTERM', () => {
	void gracefulShutdown('SIGTERM');
});

process.on('beforeExit', async () => {
	if (isShuttingDown) return;
	isShuttingDown = true;

	try {
		await shutdownLangfuse();
		await shutdownSentry();
	} catch (error) {
		logger.error({ error }, '❌ Erro no shutdown via beforeExit');
	}
});

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
