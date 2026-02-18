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
		beforeBreadcrumb(breadcrumb) {
			// Filtra breadcrumbs sensíveis
			if (breadcrumb.category === 'http' && breadcrumb.data?.url) {
				delete breadcrumb.data.headers;
			}
			return breadcrumb;
		},
	});

	console.log('[Sentry] Initialized');
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
