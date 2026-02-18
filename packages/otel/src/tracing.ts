import { trace, Span, SpanStatusCode, SpanKind, Context, Tracer } from '@opentelemetry/api';

export interface TracingOptions {
	/**
	 * Optional attributes to add to the span
	 */
	attributes?: Record<string, any>;
	/**
	 * The kind of span (internal, server, client, producer, consumer)
	 */
	kind?: SpanKind;
	/**
	 * Links to other spans (for correlating traces)
	 */
	links?: import('@opentelemetry/api').Link[];
}

/**
 * Wraps a function execution in an OpenTelemetry span
 *
 * @example
 * ```ts
 * const result = await startSpan('database.query', async (span) => {
 *   span.setAttribute('db.name', 'users');
 *   const data = await db.query('SELECT * FROM users');
 *   span.setAttribute('db.row_count', data.length);
 *   return data;
 * });
 * ```
 */
export async function startSpan<T>(
	name: string,
	fn: (span: Span) => Promise<T> | T,
	options?: TracingOptions,
): Promise<T> {
	const tracer = trace.getTracer('nexo-ai');

	return tracer.startActiveSpan(
		name,
		{
			kind: options?.kind,
			attributes: options?.attributes,
			links: options?.links,
		},
		async (span: Span) => {
			try {
				const result = await fn(span);
				span.setStatus({ code: SpanStatusCode.OK });
				return result;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				span.recordException(errorMessage);
				span.setStatus({
					code: SpanStatusCode.ERROR,
					message: errorMessage,
				});
				throw error;
			} finally {
				span.end();
			}
		},
	);
}

/**
 * Adds attributes to the currently active span
 *
 * @example
 * ```ts
 * setAttributes({
 *   'user.id': userId,
 *   'conversation.id': conversationId,
 * });
 * ```
 */
export function setAttributes(attributes: Record<string, any>): void {
	const activeSpan = trace.getActiveSpan();
	if (activeSpan) {
		activeSpan.setAttributes(attributes);
	}
}

/**
 * Records an exception on the currently active span
 *
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   recordException(error as Error);
 *   throw error;
 * }
 * ```
 */
export function recordException(error: Error, attributes?: Record<string, any>): void {
	const activeSpan = trace.getActiveSpan();
	if (activeSpan) {
		if (attributes) {
			activeSpan.setAttributes(attributes);
		}
		activeSpan.recordException(error);
		activeSpan.setStatus({
			code: SpanStatusCode.ERROR,
			message: error.message,
		});
	}
}

/**
 * Gets the current trace ID from the active span context
 *
 * Useful for correlating logs with traces or passing trace IDs to external services
 *
 * @example
 * ```ts
 * const traceId = getCurrentTraceId();
 * logger.info({ traceId }, 'Processing message');
 * ```
 */
export function getCurrentTraceId(): string | undefined {
	const activeSpan = trace.getActiveSpan();
	return activeSpan?.spanContext().traceId;
}

/**
 * Gets the current span ID from the active span context
 */
export function getCurrentSpanId(): string | undefined {
	const activeSpan = trace.getActiveSpan();
	return activeSpan?.spanContext().spanId;
}

/**
 * Sets a status on the currently active span
 */
export function setStatus(code: SpanStatusCode, message?: string): void {
	const activeSpan = trace.getActiveSpan();
	if (activeSpan) {
		activeSpan.setStatus({ code, message });
	}
}

/**
 * Adds an event to the currently active span
 *
 * @example
 * ```ts
 * addEvent('user.action', {
 *   'action.type': 'button_click',
 *   'action.target': 'submit'
 * });
 * ```
 */
export function addEvent(name: string, attributes?: Record<string, any>): void {
	const activeSpan = trace.getActiveSpan();
	if (activeSpan) {
		activeSpan.addEvent(name, attributes);
	}
}

/**
 * Wraps a synchronous function in an OpenTelemetry span
 */
export function startSpanSync<T>(
	name: string,
	fn: (span: Span) => T,
	options?: TracingOptions,
): T {
	const tracer = trace.getTracer('nexo-ai');

	return tracer.startActiveSpan(
		name,
		{
			kind: options?.kind,
			attributes: options?.attributes,
			links: options?.links,
		},
		(span: Span) => {
			try {
				const result = fn(span);
				span.setStatus({ code: SpanStatusCode.OK });
				return result;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				span.recordException(errorMessage);
				span.setStatus({
					code: SpanStatusCode.ERROR,
					message: errorMessage,
				});
				throw error;
			} finally {
				span.end();
			}
		},
	);
}

/**
 * Checks if a span is currently active
 */
export function isSpanActive(): boolean {
	return trace.getActiveSpan() !== undefined;
}

/**
 * Gets the active span (returns undefined if no span is active)
 */
export function getActiveSpan(): Span | undefined {
	return trace.getActiveSpan();
}
