import * as otel from '@opentelemetry/sdk-node';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { type LangfuseExporterConfig, getLangfuseSpanProcessor, getTraceExporter } from './exporters';
import { getAutoInstrumentations } from './instrumentations';
import { getResource, getResourceFromEnv } from './resource';

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

	/**
	 * Langfuse SDK v4 integration via LangfuseSpanProcessor.
	 * Pass `true` to use LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY env vars,
	 * or pass a config object for full control.
	 */
	langfuse?: LangfuseExporterConfig | boolean;
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

	// Build span processors
	const spanProcessors: SpanProcessor[] = [];

	if (config?.langfuse) {
		const langfuseConfig = typeof config.langfuse === 'boolean' ? undefined : config.langfuse;
		const langfuseProcessor = getLangfuseSpanProcessor(langfuseConfig);
		if (langfuseProcessor) {
			spanProcessors.push(langfuseProcessor);
			const langfuseUrl =
				(typeof config.langfuse === 'object' && config.langfuse.baseUrl) ?? process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com';
			console.log(`[OTEL] Langfuse enabled → ${langfuseUrl}`);
		}
	}

	// Create and start SDK
	sdk = new otel.NodeSDK({
		resource,
		traceExporter,
		instrumentations,
		spanProcessors,
	});

	sdk.start();

	const otlpEndpoint = config?.traceExporterEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
	const jaegerUiUrl = process.env.JAEGER_UI_URL;

	console.log(`[OTEL] Initialized for ${serviceName} (${environment})`);
	console.log(`[OTEL] Tracing → ${otlpEndpoint ?? 'disabled (no OTEL_EXPORTER_OTLP_ENDPOINT)'}`);
	if (jaegerUiUrl) {
		console.log(`[OTEL] Jaeger UI → ${jaegerUiUrl}`);
	}
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
