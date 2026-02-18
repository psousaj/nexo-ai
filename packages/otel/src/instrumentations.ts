import { Instrumentation } from '@opentelemetry/instrumentation';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

export interface InstrumentationConfig {
	/**
	 * List of instrumentations to enable. If not provided, all available instrumentations are enabled.
	 */
	instrumentations?: string[];

	/**
	 * HTTP request headers to include in spans
	 */
	httpHeadersToInclude?: string[];

	/**
	 * Whether to instrument HTTP requests
	 */
	httpInstrumentation?: boolean;

	/**
	 * Whether to instrument Redis operations
	 */
	redisInstrumentation?: boolean;

	/**
	 * Whether to instrument Bull/BullMQ queues
	 */
	bullInstrumentation?: boolean;
}

/**
 * Gets auto-instrumentations for Node.js applications
 *
 * This includes instrumentation for:
 * - HTTP/HTTPS (incoming and outgoing requests)
 * - Express/Hono/Fastify web frameworks
 * - Redis (ioredis)
 * - Bull/BullMQ queues
 * - PostgreSQL (pg)
 * - And more based on installed packages
 */
export function getAutoInstrumentations(config?: InstrumentationConfig): Instrumentation[] {
	const options: Record<string, any> = {};

	if (config?.httpHeadersToInclude) {
		options['@opentelemetry/instrumentation-http'] = {
			headersToSpanAttributes: {
				requestHeaders: config.httpHeadersToInclude,
				responseHeaders: config.httpHeadersToInclude,
			},
		};
	}

	if (config?.instrumentations) {
		// Filter instrumentations based on the provided list
		const allInstrumentations = getNodeAutoInstrumentations(options);
		return allInstrumentations.filter((inst) =>
			config.instrumentations!.some((name) => inst.instrumentationName.includes(name)),
		);
	}

	return getNodeAutoInstrumentations(options);
}
