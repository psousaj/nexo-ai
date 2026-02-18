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

		// Sentry Logs (v10+) — envia logs estruturados para o dashboard
		enableLogs: true,

		// Integrações — Sentry v10 usa funções, não namespace Integrations
		integrations: [
			Sentry.linkedErrorsIntegration(),
			Sentry.requestDataIntegration(),
			Sentry.consoleLoggingIntegration(),
		],

		// Filtros de dados sensíveis
		beforeSend(event) {
			if (event.request) {
				delete event.request.cookies;
				delete event.request.headers?.['authorization'];
			}
			return event;
		},

		// Breadcrumbs automáticos
		beforeBreadcrumb(breadcrumb) {
			if (breadcrumb.category === 'http' && breadcrumb.data?.url) {
				delete breadcrumb.data.headers;
			}
			return breadcrumb;
		},

		// Filtro para dados sensíveis em transactions
		beforeSendTransaction(event) {
			if (event.request) {
				delete event.request.cookies;
				delete event.request.headers?.['authorization'];
			}
			return event;
		},

		debug: env.NODE_ENV === 'development',
	});

	console.log('[Sentry] Initialized (v10) with Logs enabled');
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
 * Logger do Sentry para enviar logs estruturados (v10 Sentry.logger nativo)
 * Logs aparecem na aba "Logs" do dashboard do Sentry
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
