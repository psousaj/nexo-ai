import 'newrelic';
import { startDiscordBot } from '@/adapters/messaging/discord-adapter';
import { env } from '@/config/env';
import app from '@/server';
import { logger } from '@/utils/logger';
import { serve } from '@hono/node-server';
import pkg from '../package.json';

const port = env.PORT;

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

		logger.info(`🚀 Nexo AI rodando em http://0.0.0.0:${info.port}`);
		logger.info(`📦 Version: ${pkg.version}`);
		logger.info(`🌍 Environment: ${env.NODE_ENV}`);
		logger.info(`⚡ Runtime: ${process.versions.bun ? 'Bun' : 'Node.js'}`);
	},
);
