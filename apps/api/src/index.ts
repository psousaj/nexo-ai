import './otel';
import './sentry';
import { initBot } from '@/channels/telegram/bot';
import { getApiEnv } from '@/config/env';
import { shutdownSentry } from '@/sentry';
import app from '@/server';
import { logger } from '@/utils/logger';
import { serve } from '@hono/node-server';
import pkg from '../package.json';

const apiEnv = getApiEnv();
const port = apiEnv.PORT;

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
		logger.info(`🚀 Nexo AI Hermes rodando em http://0.0.0.0:${info.port}`);
		logger.info(`📦 Version: ${pkg.version}`);
		logger.info(`🌍 Environment: ${apiEnv.NODE_ENV}`);

		if (process.env.BOT_TOKEN_TELEGRAM) {
			initBot({ botToken: process.env.BOT_TOKEN_TELEGRAM });
			logger.info('🤖 Telegram bot initialized');
		}
	},
);
