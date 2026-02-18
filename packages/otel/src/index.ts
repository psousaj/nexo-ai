import * as otel from '@opentelemetry/sdk-node';
import { getResource, getResourceFromEnv } from './resource';
import { getAutoInstrumentations } from './instrumentations';
import { getTraceExporter } from './exporters';

let sdk: otel.NodeSDK | null = null;

export interface InitializeOtelConfig {
	/**
	 * Service name for tracing (defaults to OTEL_SERVICE_NAME env var)
	 */
	serviceName?: string;

	/**
	 * Service version (defaults to npm_package_version env var)
	 */
	serviceVersion?: string;

	/**
	 * Deployment environment (defaults to NODE_ENV env var)
	 */
	environment?: string;

	/**
	 * OTLP endpoint for exporting traces (defaults to OTEL_EXPORTER_OTLP_ENDPOINT env var)
	 */
	traceExporterEndpoint?: string;

	/**
	 * Additional resource attributes
	 */
	additionalAttributes?: Record<string, string>;

	/**
	 * List of instrumentations to enable (if not provided, all are enabled)
	 */
	instrumentations?: string[];

	/**
	 * HTTP headers to include in spans
	 */
	httpHeadersToInclude?: string[];
}

/**
 * Initializes the OpenTelemetry SDK for the application
 *
 * This should be called as early as possible in the application lifecycle,
 * before importing any other modules that should be instrumented.
 *
 * @example
 * ```ts
 * import { initializeOtel } from '@nexo/otel';
 *
 * initializeOtel({
 *   serviceName: 'my-service',
 *   environment: 'production',
 * });
 * ```
 *
 * @param config - Configuration options
 */
export function initializeOtel(config?: InitializeOtelConfig): void {
	if (sdk) {
		console.warn('[OTEL] SDK already initialized. Skipping initialization.');
		return;
	}

	// Read config from params, env vars, or defaults
	const envConfig = getResourceFromEnv();
	const serviceName = config?.serviceName || envConfig.serviceName;
	const serviceVersion = config?.serviceVersion || envConfig.serviceVersion;
	const environment = config?.environment || envConfig.environment;

	// Build resource
	const resource = getResource({
		serviceName,
		serviceVersion,
		environment,
		additionalAttributes: config?.additionalAttributes,
	});

	// Build trace exporter
	const traceExporter = getTraceExporter({
		endpoint: config?.traceExporterEndpoint,
	});

	// Build instrumentations
	const instrumentations = getAutoInstrumentations({
		instrumentations: config?.instrumentations,
		httpHeadersToInclude: config?.httpHeadersToInclude,
	});

	// Create and start SDK
	sdk = new otel.NodeSDK({
		resource,
		traceExporter,
		instrumentations,
		// Configure span processors for sampling, batching, etc.
		spanProcessors: [],
	});

	sdk.start();

	console.log(`[OTEL] Initialized for ${serviceName} (${environment})`);
	console.log(`[OTEL] Exporting traces to: ${config?.traceExporterEndpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'none (configured for no-op)'}`);
}

/**
 * Shuts down the OpenTelemetry SDK
 *
 * This should be called when the application is shutting down to ensure
 * all spans are exported before the process exits.
 *
 * @example
 * ```ts
 * process.on('SIGTERM', async () => {
 *   await shutdownOtel();
 *   process.exit(0);
 * });
 * ```
 */
export async function shutdownOtel(): Promise<void> {
	if (!sdk) {
		console.warn('[OTEL] SDK not initialized. Nothing to shutdown.');
		return;
	}

	try {
		await sdk.shutdown();
		console.log('[OTEL] SDK shutdown complete');
		sdk = null;
	} catch (error) {
		console.error('[OTEL] Error during SDK shutdown:', error);
		throw error;
	}
}

/**
 * Checks if the OpenTelemetry SDK has been initialized
 */
export function isOtelInitialized(): boolean {
	return sdk !== null;
}
