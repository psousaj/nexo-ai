import './otel'; // OpenTelemetry must be imported first
import './sentry'; // Sentry error tracking
import { startDiscordBot } from '@nexo/api-core/adapters/messaging/discord-adapter';
import { getApiEnv } from '@nexo/api-core/config/env';
import { shutdownSentry } from '@/sentry';
import app from '@/server';
import { globalErrorHandler } from '@nexo/api-core/services/error/error.service';
import { featureFlagService } from '@nexo/api-core/services/feature-flag.service';
import { logger } from '@nexo/api-core/utils/logger';
import { serve } from '@hono/node-server';
import pkg from '../package.json';

const apiEnv = getApiEnv();
const port = apiEnv.PORT;

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

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
	if (isShuttingDown) return;
	isShuttingDown = true;

	logger.info({ signal }, '🛑 Encerrando aplicação (graceful shutdown)');

	try {
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
		await shutdownSentry();
	} catch (error) {
		logger.error({ error }, '❌ Erro no shutdown via beforeExit');
	}
});

serve(
	{
		fetch: app.fetch,
		port,
	},
	async (info) => {
		// Inicializar FeatureFlagService (seed BD + InMemoryProvider)
		try {
			await featureFlagService.initialize();
		} catch (error) {
			logger.error({ error }, '❌ Falha ao inicializar FeatureFlagService');
		}

		// Iniciar bot do Discord se configurado
		if (apiEnv.DISCORD_BOT_TOKEN && !apiEnv.PROVIDER_SPLIT) {
			try {
				await startDiscordBot(apiEnv.DISCORD_BOT_TOKEN);
			} catch (error) {
				logger.error({ error }, '❌ Falha ao iniciar bot Discord');
			}
		}

		logger.info(`🚀 Nexo AI rodando em http://0.0.0.0:${info.port}`);
		logger.info(`📦 Version: ${pkg.version}`);
		logger.info(`🌍 Environment: ${apiEnv.NODE_ENV}`);
		logger.info(`⚡ Runtime: ${process.versions.bun ? 'Bun' : 'Node.js'}`);
	},
);
