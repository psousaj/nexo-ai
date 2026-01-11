import { env } from '@/config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const currentLevel = (env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
	return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(context: string | undefined, message: string, data?: any): string {
	const timestamp = new Date().toISOString();
	const ctx = context ? `[${context}]` : '';
	const dataStr = data ? ` ${JSON.stringify(data)}` : '';
	return `${timestamp} ${ctx} ${message}${dataStr}`;
}

/**
 * Logger simples compatível com Cloudflare Workers
 * Usa console.log nativo (Workers tem observability integrado)
 */
function createLogger(context?: string) {
	return {
		debug: (message: string, data?: any) => {
			if (shouldLog('debug')) console.debug(formatMessage(context, message, data));
		},
		info: (message: string, data?: any) => {
			if (shouldLog('info')) console.info(formatMessage(context, message, data));
		},
		warn: (message: string, data?: any) => {
			if (shouldLog('warn')) console.warn(formatMessage(context, message, data));
		},
		error: (message: string, data?: any) => {
			if (shouldLog('error')) console.error(formatMessage(context, message, data));
		},
		child: (opts: { context: string }) => createLogger(opts.context),
	};
}

export const logger = createLogger();

/**
 * Loggers específicos por contexto
 */
export const loggers = {
	webhook: createLogger('webhook'),
	ai: createLogger('ai'),
	cloudflare: createLogger('cloudflare'),
	gemini: createLogger('gemini'),
	db: createLogger('db'),
	enrichment: createLogger('enrichment'),
};
