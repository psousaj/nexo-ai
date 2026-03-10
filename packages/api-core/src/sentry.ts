import { logger } from '@/utils/logger';
import * as Sentry from '@sentry/core';

// Sentry é inicializado por cada app individualmente:
//   - apps/api: uses @sentry/node (apps/api/src/sentry.ts)
//   - apps/api-elysia: uses @sentry/bun (apps/api-elysia/src/init/sentry.ts)
// api-core only uses @sentry/core for platform-agnostic capture helpers.

const sentryLog = logger.child({ context: 'SENTRY' });

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

export async function shutdownSentry(timeoutMs = 3000): Promise<void> {
	try {
		await Sentry.flush(timeoutMs);
		await Sentry.close(timeoutMs);
		sentryLog.info('✅ Sentry shutdown concluído');
	} catch (error) {
		sentryLog.error({ error }, '❌ Erro ao finalizar Sentry');
	}
}
