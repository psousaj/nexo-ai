/**
 * Bun-compatible Sentry initialization.
 * Does NOT import @sentry/profiling-node (uses uv_default_loop — incompatível com Bun).
 * O profiling é um recurso Node.js-específico e não funciona no Bun.
 */
import { env } from '@nexo/api-core/config/env';
import { logger } from '@nexo/api-core/utils/logger';
import * as Sentry from '@sentry/bun';

const sentryLog = logger.child({ context: 'SENTRY' });

export function initializeSentry() {
	if (!env.SENTRY_DSN) {
		sentryLog.warn('SENTRY_DSN não configurado - Sentry desativado');
		return;
	}

	Sentry.init({
		dsn: env.SENTRY_DSN,
		environment: env.NODE_ENV,

		tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE || (env.NODE_ENV === 'development' ? 1.0 : 0.1),

		enableLogs: true,

		// Sem nodeProfilingIntegration() — incompatível com Bun
		integrations: [],
		// @sentry/bun inclui integrations Bun-nativas automaticamente

		beforeBreadcrumb(breadcrumb) {
			if (breadcrumb.category === 'http' && breadcrumb.data?.url) {
				delete breadcrumb.data.headers;
			}
			return breadcrumb;
		},

		beforeSendTransaction(event) {
			if (event.request) {
				delete event.request.cookies;
				delete event.request.headers?.authorization;
			}
			return event;
		},

		beforeSend(event) {
			if (event.request) {
				delete event.request.cookies;
				delete event.request.headers?.authorization;
			}
			return event;
		},

		debug: false,
	});

	sentryLog.info('✅ Sentry inicializado (Bun-compat, sem profiling)');
}

export function shutdownSentry() {
	return Sentry.close(2000);
}

// Auto-inicializa ao importar
initializeSentry();
