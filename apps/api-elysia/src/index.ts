// OTel é gerenciado pelo plugin @elysiajs/opentelemetry no server.ts (Bun-compat)
import '@/init/sentry'; // Sentry sem profiling-node (Bun-compat)
import { startDiscordBot } from '@nexo/api-core/adapters/messaging/discord-adapter';
import { env } from '@nexo/api-core/config/env';
import { shutdownSentry } from '@/init/sentry';
import { featureFlagService } from '@nexo/api-core/services/feature-flag.service';
import { globalErrorHandler } from '@nexo/api-core/services/error/error.service';
import { initializeLangfuse, shutdownLangfuse } from '@nexo/api-core/services/langfuse';
import { logger } from '@nexo/api-core/utils/logger';
import app from '@/server';
import pkg from '../package.json';

const port = env.PORT;

process.on('unhandledRejection', async (reason) => {
	await globalErrorHandler.handle(reason instanceof Error ? reason : new Error(String(reason)), {
		provider: 'process',
		state: 'unhandled_rejection',
		extra: { reason: reason instanceof Error ? reason.message : String(reason) },
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
		extra: { name: warning.name, message: warning.message },
	});
});

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

process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));

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
 * Inicializar Baileys se a API ativa for 'baileys'.
 */
async function initializeBaileysIfActive(): Promise<void> {
	try {
		const { getWhatsAppSettings } = await import('@nexo/api-core/adapters/messaging');
		const settings = await getWhatsAppSettings();

		if (settings.activeApi === 'baileys') {
			logger.info('📱 Baileys é a API ativa, inicializando...');
			const { getBaileysService } = await import('@nexo/api-core/services/baileys-service');
			await getBaileysService();
			logger.info('✅ Baileys inicializado e pronto para receber mensagens');
		} else {
			logger.info('📱 Meta API é a API ativa (Baileys não será inicializado)');
		}
	} catch (error) {
		logger.error({ error }, '❌ Erro ao verificar/inicializar Baileys');
	}
}

// Start Elysia server using native Bun listener
app.listen(port, async () => {
	try {
		await featureFlagService.initialize();
	} catch (error) {
		logger.error({ error }, '❌ Falha ao inicializar FeatureFlagService');
	}

	if (env.DISCORD_BOT_TOKEN) {
		try {
			await startDiscordBot(env.DISCORD_BOT_TOKEN);
		} catch (error) {
			logger.error({ error }, '❌ Falha ao iniciar bot Discord');
		}
	}

	await initializeBaileysIfActive();

	logger.info(`🚀 Nexo AI (Elysia/Bun) rodando em http://0.0.0.0:${port}`);
	logger.info(`📦 Version: ${pkg.version}`);
	logger.info(`🌍 Environment: ${env.NODE_ENV}`);
	logger.info(`⚡ Runtime: Bun ${Bun.version}`);
});
