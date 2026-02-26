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

function sanitizeForSentry(value: unknown): unknown {
	if (value === null || value === undefined) return String(value);
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
	try {
		return JSON.parse(JSON.stringify(value));
	} catch {
		return String(value);
	}
}

function extractErrorForSentry(args: unknown[]): { error: Error; extra: Record<string, unknown> } | null {
	try {
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
					extra[key] = sanitizeForSentry(value);
				}
			}
		}

		if (typeof secondArg === 'string') {
			extra.logMessage = secondArg;
		}

		return { error: candidateError, extra };
	} catch {
		return null;
	}
}

function createContextLogger(context: string): pino.Logger {
	const child = logger.child({ context }) as any;
	const originalError = child.error.bind(child);

	child.error = (...args: unknown[]) => {
		const parsed = extractErrorForSentry(args); // já tem try/catch interno
		if (parsed) {
			try {
				if (Sentry.getClient()) {
					Sentry.captureException(parsed.error, {
						tags: {
							context,
							source: 'pino.error',
						},
						extra: parsed.extra,
					});
				}
			} catch {
				// noop: Sentry nunca deve quebrar fluxo da aplicação
			}
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
	baileys: createContextLogger('BAILEYS'),
	tools: createContextLogger('TOOLS'),
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
	if (error instanceof Error) {
		logger.error({ err: error, ...context }, error.message);
	} else if (typeof error === 'string') {
		logger.error({ ...context }, error);
	} else {
		// objeto não-Error (ex: ToolOutput { success: false, error: '...' })
		logger.error({ payload: sanitizeForSentry(error), ...context }, 'logError: valor não-Error recebido');
	}
}
