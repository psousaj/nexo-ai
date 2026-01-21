import 'newrelic';
import { serve } from '@hono/node-server';
import app from '@/app';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import pkg from '../package.json';

const port = env.PORT;

serve(
	{
		fetch: app.fetch,
		port,
	},
	(info) => {
		logger.info(`🚀 Nexo AI rodando em http://0.0.0.0:${info.port}`);
		logger.info(`📦 Version: ${pkg.version}`);
		logger.info(`🌍 Environment: ${env.NODE_ENV}`);
		logger.info(`⚡ Runtime: ${process.versions.bun ? 'Bun' : 'Node.js'}`);
	},
);
