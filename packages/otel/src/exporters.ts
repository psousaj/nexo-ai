import { LangfuseSpanProcessor } from '@langfuse/otel';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { ExportResultCode } from '@opentelemetry/core';
import type { ExportResult } from '@opentelemetry/core';
import type { ReadableSpan, SpanExporter, SpanProcessor } from '@opentelemetry/sdk-trace-base';

export interface ExporterConfig {
	endpoint?: string;
	headers?: Record<string, string>;
}

export interface LangfuseExporterConfig {
	/**
	 * Langfuse public key. Defaults to LANGFUSE_PUBLIC_KEY env var.
	 */
	publicKey?: string;
	/**
	 * Langfuse secret key. Defaults to LANGFUSE_SECRET_KEY env var.
	 */
	secretKey?: string;
	/**
	 * Langfuse base URL. Defaults to LANGFUSE_BASE_URL or https://cloud.langfuse.com
	 */
	baseUrl?: string;
	/**
	 * Environment identifier for traces. Defaults to LANGFUSE_TRACING_ENVIRONMENT env var.
	 */
	environment?: string;
	/**
	 * Export mode: "batched" (production) or "immediate" (serverless).
	 * @defaultValue "batched"
	 */
	exportMode?: 'immediate' | 'batched';
	/**
	 * Function to mask sensitive data before export.
	 * Use `unknown` here and narrow inside your function body.
	 */
	mask?: (params: { data: unknown }) => unknown;
	/**
	 * Function to filter which spans are exported to Langfuse.
	 */
	shouldExportSpan?: (params: { otelSpan: ReadableSpan }) => boolean;
}

/**
 * Creates a LangfuseSpanProcessor (SDK v4) for exporting AI spans to Langfuse.
 *
 * Reads LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL from env if not provided.
 * Returns null if credentials are not configured.
 */
export function getLangfuseSpanProcessor(config?: LangfuseExporterConfig): SpanProcessor | null {
	const publicKey = config?.publicKey ?? process.env.LANGFUSE_PUBLIC_KEY;
	const secretKey = config?.secretKey ?? process.env.LANGFUSE_SECRET_KEY;

	if (!publicKey || !secretKey) {
		console.warn('[OTEL] Langfuse not configured: set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY.');
		return null;
	}

	return new LangfuseSpanProcessor({
		publicKey,
		secretKey,
		baseUrl: config?.baseUrl ?? process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
		environment: config?.environment ?? process.env.LANGFUSE_TRACING_ENVIRONMENT,
		exportMode: config?.exportMode ?? 'batched',
		mask: config?.mask,
		shouldExportSpan: config?.shouldExportSpan,
	});
}

/**
 * Creates an OTLP trace exporter for sending traces to Jaeger or other OTLP-compatible backends
 */
export function getTraceExporter(config?: ExporterConfig): SpanExporter {
	const endpoint = config?.endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

	if (!endpoint) {
		console.warn('[OTEL] No OTLP endpoint configured. Set OTEL_EXPORTER_OTLP_ENDPOINT environment variable.');
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
		export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
			console.log(`[OTEL] Would export ${spans.length} spans (no OTLP endpoint configured)`);
			resultCallback({ code: ExportResultCode.SUCCESS });
		},
		shutdown(): Promise<void> {
			return Promise.resolve();
		},
		forceFlush(): Promise<void> {
			return Promise.resolve();
		},
	};
}
