import pino from 'pino';

/**
 * Pino logger com transports para New Relic e pretty print em dev
 */
export const logger = pino({
	level: process.env.LOG_LEVEL || 'info',
	context: 'APP',
	transport:
		process.env.NODE_ENV === 'development'
			? {
					target: 'pino-pretty',
					options: {
						colorize: true,
						translateTime: 'dd/mm/yy HH:MM:ss',
						ignore: 'pid,hostname,context,level',
						messageFormat: '[{context}] {level}: {msg}',
					},
			  }
			: undefined,
	formatters: {
		level: (label) => {
			return { level: label.toUpperCase() };
		},
		context: (context) => {
			return { context: context.toUpperCase() };
		},
	},
});

/**
 * Loggers específicos por contexto
 */
export const loggers = {
	webhook: logger.child({ context: 'WEBHOOK' }),
	ai: logger.child({ context: 'AI' }),
	cloudflare: logger.child({ context: 'CLOUDFLARE' }),
	gemini: logger.child({ context: 'GEMINI' }),
	db: logger.child({ context: 'DB' }),
	enrichment: logger.child({ context: 'ENRICHMENT' }),
	cache: logger.child({ context: 'CACHE' }),
	retry: logger.child({ context: 'RETRY' }),
	queue: logger.child({ context: 'QUEUE' }),
};

/**
 * Helper para logar erros com contexto estruturado
 */
export function logError(error: unknown, context: Record<string, any> = {}) {
	const err = error as Error;
	logger.error({
		message: err.message,
		stack: err.stack,
		...context,
	});
}
