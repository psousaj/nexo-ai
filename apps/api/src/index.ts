<<<<<<< HEAD
import './otel'; // OpenTelemetry must be imported first
import './sentry'; // Sentry error tracking
import { startDiscordBot } from '@/adapters/messaging/discord-adapter';
import { getApiEnv } from '@/config/env';
import { shutdownSentry } from '@/sentry';
import app from '@/server';
import { globalErrorHandler } from '@/services/error/error.service';
import { featureFlagService } from '@/services/feature-flag.service';
import { shutdownQueues } from '@/services/queue-service';
=======
import './otel';
import './sentry';
import { initBot } from '@/channels/telegram/bot';
import { getApiEnv } from '@/config/env';
import { initializeDatabase, shutdownDatabase } from '@/db';
import { shutdownSentry } from '@/sentry';
import app from '@/server';
>>>>>>> development
import { logger } from '@/utils/logger';
import { serve } from '@hono/node-server';
import pkg from '../package.json';

const apiEnv = getApiEnv();
const port = apiEnv.PORT;

<<<<<<< HEAD
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

=======
>>>>>>> development
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
	if (isShuttingDown) return;
	isShuttingDown = true;

	logger.info({ signal }, '🛑 Encerrando aplicação (graceful shutdown)');

	try {
<<<<<<< HEAD
		await shutdownQueues();
		logger.info('✅ Queues e workers fechados');
	} catch (error) {
		logger.error({ error }, '❌ Erro ao fechar queues durante graceful shutdown');
=======
		await shutdownDatabase();
		logger.info('✅ Shutdown do pool de banco concluído');
	} catch (error) {
		logger.error({ error }, '❌ Erro ao finalizar pool de banco');
>>>>>>> development
	}

	try {
		await shutdownSentry();
		logger.info('✅ Shutdown de observabilidade concluído');
	} catch (error) {
		logger.error({ error }, '❌ Erro durante graceful shutdown');
	}
}

process.on('SIGINT', () => {
	void gracefulShutdown('SIGINT');
});

process.on('SIGTERM', () => {
	void gracefulShutdown('SIGTERM');
});

serve(
	{
		fetch: app.fetch,
		port,
	},
	async (info) => {
<<<<<<< HEAD
		// Inicializar FeatureFlagService (seed BD + InMemoryProvider)
		try {
			await featureFlagService.initialize();
		} catch (error) {
			logger.error({ error }, '❌ Falha ao inicializar FeatureFlagService');
		}

		// Iniciar bot do Discord se configurado
		if (apiEnv.DISCORD_BOT_TOKEN) {
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
=======
		initializeDatabase();
		logger.info(`🚀 Nexo AI Hermes rodando em http://0.0.0.0:${info.port}`);
		logger.info(`📦 Version: ${pkg.version}`);
		logger.info(`🌍 Environment: ${apiEnv.NODE_ENV}`);

		if (process.env.BOT_TOKEN_TELEGRAM) {
			initBot({ botToken: process.env.BOT_TOKEN_TELEGRAM });
			logger.info('🤖 Telegram bot initialized');
		}
>>>>>>> development
	},
);
