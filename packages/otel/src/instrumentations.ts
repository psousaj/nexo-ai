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
export function getAutoInstrumentations(config?: InstrumentationConfig): ReturnType<typeof getNodeAutoInstrumentations> {
	const options: Parameters<typeof getNodeAutoInstrumentations>[0] = {};

	if (config?.httpHeadersToInclude) {
		options['@opentelemetry/instrumentation-http'] = {
			headersToSpanAttributes: {
				client: {
					requestHeaders: config.httpHeadersToInclude,
					responseHeaders: config.httpHeadersToInclude,
				},
				server: {
					requestHeaders: config.httpHeadersToInclude,
					responseHeaders: config.httpHeadersToInclude,
				},
			},
		};
	}

	if (config?.instrumentations) {
		// Filter instrumentations based on the provided list
		const allInstrumentations = getNodeAutoInstrumentations(options);
		return allInstrumentations.filter((inst) => config.instrumentations!.some((name) => inst.instrumentationName.includes(name)));
	}

	return getNodeAutoInstrumentations(options);
}
