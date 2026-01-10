import pino from 'pino';
import { env } from '@/config/env';

const isDev = env.NODE_ENV === 'development';

/**
 * Logger configurado com pino
 * Em desenvolvimento: usa pino-pretty
 * Em produção: usa formato JSON estruturado
 */
export const logger = pino({
	level: env.LOG_LEVEL || 'info',
	transport: isDev
		? {
				target: 'pino-pretty',
				options: {
					colorize: true,
					translateTime: 'HH:MM:ss',
					ignore: 'pid,hostname',
				},
		  }
		: undefined,
});

/**
 * Loggers específicos por contexto
 */
export const loggers = {
	webhook: logger.child({ context: 'webhook' }),
	ai: logger.child({ context: 'ai' }),
	cloudflare: logger.child({ context: 'cloudflare' }),
	gemini: logger.child({ context: 'gemini' }),
	db: logger.child({ context: 'db' }),
	enrichment: logger.child({ context: 'enrichment' }),
};
