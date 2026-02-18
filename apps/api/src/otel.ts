import { initializeOtel } from '@nexo/otel';
import { env } from '@/config/env';

// Initialize OpenTelemetry
// This module is imported as the first thing in index.ts to ensure
// all subsequent imports are instrumented
initializeOtel({
	serviceName: '@nexo/api',
	environment: env.NODE_ENV,
	traceExporterEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
	additionalAttributes: {
		'app.version': process.env.npm_package_version || 'unknown',
	},
});
