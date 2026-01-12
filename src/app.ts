import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { openapi } from '@elysiajs/openapi';
import { opentelemetry } from '@elysiajs/opentelemetry';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { env } from '@/config/env';
import { healthRouter } from '@/routes/health';
import { webhookRoutes as webhookRouter } from '@/routes/webhook-new';
import { itemsRouter } from '@/routes/items';

// OpenTelemetry exporter (Uptrace)
const traceExporter = env.UPTRACE_DSN
	? new OTLPTraceExporter({
			url: 'https://otlp.uptrace.dev/v1/traces',
			headers: {
				'uptrace-dsn': env.UPTRACE_DSN,
			},
	  })
	: undefined;

const app = new Elysia()
	.use(cors())
	.use(
		openapi({
			documentation: {
				info: {
					title: 'Nexo AI API',
					version: '0.2.5',
					description: 'Assistente pessoal via WhatsApp/Telegram com IA',
				},
				tags: [
					{ name: 'Health', description: 'Health check endpoints' },
					{ name: 'Items', description: 'Items management' },
					{ name: 'Webhook', description: 'Messaging webhooks' },
				],
			},
		})
	)
	.use(
		traceExporter
			? opentelemetry({
					serviceName: 'nexo-ai',
					spanProcessors: [new BatchSpanProcessor(traceExporter)],
			  })
			: (app) => app
	)
	.onError(({ code, error, set }) => {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorStack = error instanceof Error ? error.stack : undefined;

		console.error('[ERROR]', { code, message: errorMessage, stack: errorStack });

		// Validation errors com detalhes (apenas em dev)
		if (code === 'VALIDATION') {
			set.status = 400;
			return {
				error: 'Validation failed',
				message: errorMessage,
				type: 'validation',
			};
		}

		// Not found
		if (code === 'NOT_FOUND') {
			set.status = 404;
			return { error: 'Route not found' };
		}

		// Parse errors
		if (code === 'PARSE') {
			set.status = 400;
			return { error: 'Invalid request body', message: errorMessage };
		}

		// Internal server errors
		set.status = 500;
		return {
			error: 'Internal server error',
			// Só envia stack trace em dev
			...(env.NODE_ENV !== 'production' && { message: errorMessage }),
		};
	})
	.use(healthRouter)
	.use(webhookRouter)
	.group('/items', (app) => app.use(itemsRouter));

export default app;
