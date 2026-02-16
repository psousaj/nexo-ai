import pino from 'pino';

/**
 * Pino logger com transports para New Relic e pretty print em dev
 */
export const logger = pino({
	level: process.env.LOG_LEVEL || 'info',
	base: { context: 'APP' },
	transport:
		process.env.NODE_ENV === 'development'
			? {
					target: 'pino-pretty',
					options: {
						colorize: true,
						translateTime: 'dd/mm/yy HH:MM:ss',
						ignore: 'pid,hostname',
						messageFormat: '[{context}] {level}: {msg}',
					},
				}
			: undefined,
	formatters: {
		level: (label) => {
			return { level: label.toUpperCase() };
		},
	},
});

/**
 * Loggers específicos por contexto
 */
export const loggers = {
	app: logger.child({ context: 'APP' }),
	webhook: logger.child({ context: 'WEBHOOK' }),
	ai: logger.child({ context: 'AI' }),
	nlp: logger.child({ context: 'NLP' }),
	cloudflare: logger.child({ context: 'CLOUDFLARE' }),
	gemini: logger.child({ context: 'GEMINI' }),
	db: logger.child({ context: 'DB' }),
	enrichment: logger.child({ context: 'ENRICHMENT' }),
	cache: logger.child({ context: 'CACHE' }),
	retry: logger.child({ context: 'RETRY' }),
	queue: logger.child({ context: 'QUEUE' }),
	discord: logger.child({ context: 'DISCORD' }),
	// OpenClaw-inspired loggers
	context: logger.child({ context: 'CONTEXT' }),
	session: logger.child({ context: 'SESSION' }),
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
