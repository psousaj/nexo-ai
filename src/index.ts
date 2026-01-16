import app from '@/app';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import pkg from '../package.json';

app.listen(env.PORT, () => {
	logger.info(`🚀 Nexo AI rodando em http://0.0.0.0:${env.PORT}`);
	logger.info(`📦 Version: ${pkg.version}`);
	logger.info(`🌍 Environment: ${env.NODE_ENV}`);
	logger.info(`⚡ Runtime: Bun`);
});
