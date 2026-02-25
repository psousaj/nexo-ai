import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';

export interface ExporterConfig {
	endpoint?: string;
	headers?: Record<string, string>;
}

/**
 * Creates an OTLP trace exporter for sending traces to Jaeger or other OTLP-compatible backends
 */
export function getTraceExporter(config?: ExporterConfig): SpanExporter {
	const endpoint = config?.endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

	if (!endpoint) {
		console.warn('[OTEL] No OTLP endpoint configured. Set OTEL_EXPORTER_OTLP_ENDPOINT environment variable.');
		// Return a no-op exporter that logs spans instead
		return createNoOpExporter();
	}

	return new OTLPTraceExporter({
		url: endpoint,
		headers: config?.headers,
	});
}

/**
 * Creates a no-op exporter that logs when traces would be sent
 */
function createNoOpExporter(): SpanExporter {
	return {
		export(spans, resultCallback) {
			console.log(`[OTEL] Would export ${spans.length} spans (no endpoint configured)`);
			resultCallback({ code: 0 });
		},
		shutdown() {
			return Promise.resolve();
		},
		forceFlush() {
			return Promise.resolve();
		},
	};
}
