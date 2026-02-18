import * as Sentry from '@sentry/node';
import { env } from '@/config/env';

export function initializeSentry() {
	if (!env.SENTRY_DSN) {
		console.log('[Sentry] Not configured - skipping');
		return;
	}

	Sentry.init({
		dsn: env.SENTRY_DSN,
		environment: env.NODE_ENV,
		tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE || 0.1,

		// Habilita envio de logs estruturados para Sentry
		enableLogs: true,

		// Nível mínimo de logs para enviar (default: 'info')
		logLevel: 'info',

		// Formato dos breadcrumbs de logs
		breadcrumbLogMessage: (message, level) => `[${level}] ${message}`,

		// Integração com OpenTelemetry
		integrations: [
			// Links automaticamente traces OTEL com eventos Sentry
			new Sentry.Integrations.LinkedErrors(),
			new Sentry.Integrations.HttpContext(),
			new Sentry.Integrations.RequestData(),
		],

		// Filtros de dados sensíveis
		beforeSend(event, hint) {
			// Remove dados sensíveis de requests
			if (event.request) {
				delete event.request.cookies;
				delete event.request.headers?.['authorization'];
			}
			return event;
		},

		// Breadcrumbs automáticos
		beforeBreadcrumb(breadcrumb, hint) {
			// Filtra breadcrumbs sensíveis
			if (breadcrumb.category === 'http' && breadcrumb.data?.url) {
				delete breadcrumb.data.headers;
			}
			return breadcrumb;
		},

		// Filtro para dados sensíveis em logs
		beforeSendTransaction(event) {
			// Remove dados sensíveis de transactions
			if (event.request) {
				delete event.request.cookies;
				delete event.request.headers?.['authorization'];
			}
			return event;
		},

		// Configuração desampling de logs baseada em ambiente
		debug: env.NODE_ENV === 'development',

		// Taxa de amostragem de logs (1.0 = todos, 0.1 = 10%)
		// Em produção, pode ser útil reduzir para controlar custos
		logsSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
	});

	console.log('[Sentry] Initialized with Logs enabled');
}

export function captureException(error: Error, context?: {
	user_id?: string;
	conversation_id?: string;
	trace_id?: string;
	[key: string]: any;
}) {
	Sentry.captureException(error, {
		tags: context,
		user: context?.user_id ? { id: context.user_id } : undefined,
		extra: context,
	});
}

export function setSentryContext(key: string, context: Record<string, any>) {
	Sentry.setContext(key, context);
}

export function setSentryUser(user: { id: string; email?: string }) {
	Sentry.setUser(user);
}

/**
 * Logger do Sentry para enviar logs estruturados
 * Use estes métodos para enviar logs que aparecerão no dashboard do Sentry
 */
export const sentryLogger = {
	debug: (message: string, data?: Record<string, any>) => {
		Sentry.logger.debug(message, data);
	},
	info: (message: string, data?: Record<string, any>) => {
		Sentry.logger.info(message, data);
	},
	warn: (message: string, data?: Record<string, any>) => {
		Sentry.logger.warn(message, data);
	},
	error: (message: string, error?: Error | unknown, data?: Record<string, any>) => {
		if (error instanceof Error) {
			Sentry.logger.error(message, { ...data, error: error.message, stack: error.stack });
		} else {
			Sentry.logger.error(message, { ...data, error: String(error) });
		}
	},
};

/**
 * Helper para capturar logs de performance
 */
export function capturePerformanceLog(message: string, duration: number, data?: Record<string, any>) {
	Sentry.logger.info(message, {
		...data,
		duration_ms: duration,
		performance: true,
	});
}
