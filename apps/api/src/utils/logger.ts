import pino from 'pino';
import * as Sentry from '@sentry/node';

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

function normalizeError(value: unknown): Error | null {
	if (value instanceof Error) return value;
	if (typeof value === 'string' && value.trim().length > 0) return new Error(value);
	return null;
}

function extractErrorForSentry(args: unknown[]): { error: Error; extra: Record<string, unknown> } | null {
	const firstArg = args[0] as any;
	const secondArg = args[1] as any;

	const candidateError =
		normalizeError(firstArg?.err) ||
		normalizeError(firstArg?.error) ||
		normalizeError(secondArg) ||
		normalizeError(firstArg?.message) ||
		normalizeError(typeof secondArg === 'string' ? secondArg : undefined);

	if (!candidateError) return null;

	const extra: Record<string, unknown> = {};

	if (firstArg && typeof firstArg === 'object') {
		for (const [key, value] of Object.entries(firstArg)) {
			if (key !== 'err' && key !== 'error') {
				extra[key] = value;
			}
		}
	}

	if (typeof secondArg === 'string') {
		extra.logMessage = secondArg;
	}

	return { error: candidateError, extra };
}

function createContextLogger(context: string) {
	const child = logger.child({ context }) as any;
	const originalError = child.error.bind(child);

	child.error = (...args: unknown[]) => {
		try {
			const parsed = extractErrorForSentry(args);
			if (parsed && Sentry.getClient()) {
				Sentry.captureException(parsed.error, {
					tags: {
						context,
						source: 'pino.error',
					},
					extra: parsed.extra,
				});
			}
		} catch {
			// noop: logging nunca deve quebrar fluxo da aplicação
		}

		return originalError(...args);
	};

	return child;
}

/**
 * Loggers específicos por contexto
 */
export const loggers = {
	app: createContextLogger('APP'),
	webhook: createContextLogger('WEBHOOK'),
	ai: createContextLogger('AI'),
	nlp: createContextLogger('NLP'),
	cloudflare: createContextLogger('CLOUDFLARE'),
	gemini: createContextLogger('GEMINI'),
	db: createContextLogger('DB'),
	enrichment: createContextLogger('ENRICHMENT'),
	cache: createContextLogger('CACHE'),
	retry: createContextLogger('RETRY'),
	queue: createContextLogger('QUEUE'),
	discord: createContextLogger('DISCORD'),
	dateParser: createContextLogger('DATE_PARSER'),
	scheduler: createContextLogger('SCHEDULER'),
	integrations: createContextLogger('INTEGRATIONS'),
	// OpenClaw-inspired loggers
	context: createContextLogger('CONTEXT'),
	session: createContextLogger('SESSION'),
	memory: createContextLogger('MEMORY'),
	api: createContextLogger('API'),
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
