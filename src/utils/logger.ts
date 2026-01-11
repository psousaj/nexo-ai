import pino from 'pino';
import { env } from '@/config/env';

/**
 * Pino logger com transports para New Relic e pretty print em dev
 */
export const logger = pino({
	level: env.LOG_LEVEL || 'info',
	transport:
		env.NODE_ENV === 'development'
			? {
					target: 'pino-pretty',
					options: {
						colorize: true,
						translateTime: 'SYS:standard',
						ignore: 'pid,hostname',
					},
			  }
			: undefined,
	formatters: {
		level: (label) => {
			return { level: label };
		},
	},
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
