import { startSpan } from '@nexo/otel/tracing';
import { logger } from '@/utils/logger';

const serviceLogger = logger.child({ context: 'SERVICE' });

function isPromiseLike(value: unknown): value is Promise<unknown> {
	return !!value && typeof (value as Promise<unknown>).then === 'function';
}

export function instrumentService<T extends object>(serviceName: string, instance: T): T {
	return new Proxy(instance, {
		get(target, prop, receiver) {
			const original = Reflect.get(target, prop, receiver);

			if (typeof original !== 'function') {
				return original;
			}

			if (prop === 'constructor') {
				return original;
			}

			const methodName = String(prop);

			return function instrumentedMethod(this: unknown, ...args: unknown[]) {
				const spanName = `service.${serviceName}.${methodName}`;
				const startedAt = Date.now();

				return startSpan(spanName, async (span) => {
					span.setAttribute('service.name', serviceName);
					span.setAttribute('service.method', methodName);
					span.setAttribute('service.args_count', args.length);

					serviceLogger.debug({ service: serviceName, method: methodName, argsCount: args.length }, '🔍 Service call');

					try {
						const result = Reflect.apply(original, target, args);

						if (isPromiseLike(result)) {
							const awaited = await result;
							serviceLogger.debug(
								{ service: serviceName, method: methodName, durationMs: Date.now() - startedAt },
								'✅ Service call completed',
							);
							return awaited;
						}

						serviceLogger.debug(
							{ service: serviceName, method: methodName, durationMs: Date.now() - startedAt },
							'✅ Service call completed',
						);

						return result;
					} catch (error) {
						serviceLogger.error(
							{
								service: serviceName,
								method: methodName,
								durationMs: Date.now() - startedAt,
								error: error instanceof Error ? error.message : String(error),
							},
							'❌ Service call failed',
						);
						throw error;
					}
				});
			};
		},
	});
}
