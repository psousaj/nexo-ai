import { Resource } from '@opentelemetry/resources';
import {
	SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
	SEMRESATTRS_SERVICE_NAME,
	SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

export interface ResourceConfig {
	serviceName: string;
	serviceVersion?: string;
	environment: string;
	additionalAttributes?: Record<string, string>;
}

/**
 * Creates an OpenTelemetry Resource with standard attributes
 */
export function getResource(config: ResourceConfig): Resource {
	const attributes: Record<string, string> = {
		[SEMRESATTRS_SERVICE_NAME]: config.serviceName,
		[SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: config.environment,
		...config.additionalAttributes,
	};

	if (config.serviceVersion) {
		attributes[SEMRESATTRS_SERVICE_VERSION] = config.serviceVersion;
	}

	return new Resource({
		...attributes,
		'telemetry.sdk.name': 'opentelemetry',
		'telemetry.sdk.language': 'nodejs',
		'telemetry.sdk.auto': 'true',
	});
}

/**
 * Reads resource configuration from environment variables
 */
export function getResourceFromEnv(): ResourceConfig {
	const serviceName = process.env.OTEL_SERVICE_NAME || process.env.npm_package_name || 'nexo-ai-service';
	const environment =
		process.env.NODE_ENV ||
		process.env.OTEL_RESOURCE_ATTRIBUTES?.match(/deployment\.environment=([^,]+)/)?.[1] ||
		'development';

	return {
		serviceName,
		serviceVersion: process.env.npm_package_version,
		environment,
	};
}
