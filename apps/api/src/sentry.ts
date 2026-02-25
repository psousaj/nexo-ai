import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const sentryLog = logger.child({ context: 'SENTRY' });

export function initializeSentry() {
	if (!env.SENTRY_DSN) {
		sentryLog.warn('SENTRY_DSN não configurado - Sentry desativado');
		return;
	}

	Sentry.init({
		dsn: env.SENTRY_DSN,
		environment: env.NODE_ENV,

		// Tracing - Captura 100% em dev, 10% em prod
		tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE || (env.NODE_ENV === 'development' ? 1.0 : 0.1),

		// Sentry Logs (v10+) — envia logs estruturados para o dashboard
		enableLogs: true,

		// Integrações — Sentry v10 + Profiling
		integrations: [
			nodeProfilingIntegration(),
			Sentry.linkedErrorsIntegration(),
			Sentry.requestDataIntegration(),
			// consoleLoggingIntegration removido — criava loop de logs com pino
		],

		// Profiling - Captura profiling automaticamente durante traces ativos
		profileSessionSampleRate: env.NODE_ENV === 'development' ? 1.0 : 0.0,
		profileLifecycle: 'trace',

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

		// debug interno do Sentry desativado — muito verbose
		debug: false,
	});

	sentryLog.info('✅ Sentry inicializado');
}

// Auto-inicializa ao importar (compatível com `import "./sentry"` em index.ts)
initializeSentry();

export function captureException(
	error: Error,
	context?: {
		user_id?: string;
		conversation_id?: string;
		trace_id?: string;
		[key: string]: any;
	},
) {
	Sentry.captureException(error, {
		tags: context,
		user: context?.user_id ? { id: context.user_id } : undefined,
		extra: context,
	});

	void Sentry.flush(2000).catch(() => {
		// noop: não deve quebrar fluxo de aplicação por falha de flush
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

/**
 * Métricas customizadas do Sentry (v10 API)
 * Use para enviar contadores, gauges e distributions para o dashboard
 */
export const sentryMetrics = {
	/**
	 * Incrementa um contador
	 * @param key Nome da métrica (ex: 'user_actions', 'llm_calls')
	 * @param amount Valor a incrementar (default: 1)
	 * @param attributes Atributos estruturados da métrica
	 */
	increment(key: string, amount = 1, attributes?: Record<string, string | number>) {
		Sentry.metrics.count(key, amount, { attributes });
	},

	/**
	 * Define um valor absoluto (gauge)
	 * @param key Nome da métrica
	 * @param value Valor a definir
	 * @param attributes Atributos estruturados da métrica
	 */
	set(key: string, value: number, attributes?: Record<string, string | number>) {
		Sentry.metrics.gauge(key, value, { attributes });
	},

	/**
	 * Registra um timing (distribution com unit 'second')
	 * @param key Nome da métrica
	 * @param value Valor em segundos
	 * @param attributes Atributos estruturados da métrica
	 */
	timing(key: string, value: number, attributes?: Record<string, string | number>) {
		Sentry.metrics.distribution(key, value, { unit: 'second', attributes });
	},

	/**
	 * Distribuição de valores (histogram)
	 * @param key Nome da métrica
	 * @param value Valor a registrar
	 * @param unit Unidade da métrica (default: 'none')
	 * @param attributes Atributos estruturados da métrica
	 */
	distribution(key: string, value: number, unit = 'none', attributes?: Record<string, string | number>) {
		Sentry.metrics.distribution(key, value, { unit, attributes });
	},
};

/**
 * Helper simplificado para contador
 */
export function incrementCounter(key: string, amount = 1, tags?: Record<string, string>) {
	Sentry.metrics.count(key, amount, { attributes: tags });
}

/**
 * Helper simplificado para timing (em ms, usando distribution)
 */
export function recordTiming(key: string, durationMs: number, tags?: Record<string, string>) {
	Sentry.metrics.distribution(key, durationMs, { unit: 'millisecond', attributes: tags });
}
