import { bullBoardApp } from '@/plugins/bull-board';
import { betterAuthPlugin } from '@/plugins/better-auth';
import { env } from '@nexo/env';
import { sentryLogger } from '@nexo/api-core/sentry';
import { globalErrorHandler } from '@nexo/api-core/services/error/error.service';
import {
	closeConversationQueue,
	enrichmentQueue,
	messageQueue,
	responseQueue,
	runAwaitingConfirmationTimeoutCron,
	runConversationCloseCron,
} from '@nexo/api-core/services/queue-service';
import { loggers } from '@nexo/api-core/utils/logger';
import { opentelemetry } from '@elysiajs/opentelemetry';
import openapi from '@elysiajs/openapi';
import { serverTiming } from '@elysiajs/server-timing';
import * as Sentry from '@sentry/bun';
import Elysia from 'elysia';
import { cors } from '@elysiajs/cors';
import { cron } from '@elysiajs/cron';
import pkg from '../package.json';
import { healthRouter } from '@/routes/health';
import { webhookRouter } from '@/routes/webhook';
import { itemsRouter } from '@/routes/items';
import { dashboardRouter } from '@/routes/dashboard';

const app = new Elysia()
	// =========================================================================
	// CORS
	// =========================================================================
	.use(
		cors({
			origin: (request: Request) => {
				const origin = request.headers.get('origin') || '';
				if (env.NODE_ENV === 'development') return true;
				return env.CORS_ORIGINS.includes(origin);
			},
			credentials: true,
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
			allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
			exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
			maxAge: 600,
		}),
	)
	// =========================================================================
	// OPENTELEMETRY
	// =========================================================================
	.use(opentelemetry())
	// =========================================================================
	// SERVER TIMING (dev only)
	// =========================================================================
	.use(serverTiming({ enabled: env.NODE_ENV !== 'production' }))
	// =========================================================================
	// OPENAPI / SCALAR UI
	// =========================================================================
	.use(
		openapi({
			documentation: {
				info: {
					title: 'Nexo AI API',
					version: pkg.version,
					description: 'API do Nexo AI — assistente de mensagens para Telegram/WhatsApp/Discord',
				},
				tags: [
					{ name: 'health', description: 'Health checks' },
					{ name: 'webhook', description: 'Messaging webhooks' },
					{ name: 'items', description: 'Memory items CRUD' },
					{ name: 'dashboard', description: 'Dashboard routes' },
				],
			},
		}),
	)
	// =========================================================================
	// HTTP LOGGING + SENTRY BREADCRUMBS
	// =========================================================================
	.onRequest(({ request }) => {
		loggers.app.info(`${request.method} ${new URL(request.url).pathname}`);

		Sentry.addBreadcrumb({
			category: 'http',
			message: `${request.method} ${request.url}`,
			level: 'info',
			data: {
				method: request.method,
				url: request.url,
			},
		});
	})
	// =========================================================================
	// BULL BOARD — montado via fetch handler (Elysia .mount() aceita qualquer
	// handler fetch-compatible)
	// =========================================================================
	.mount('/admin/queues', bullBoardApp.fetch)
	// =========================================================================
	// CRON JOBS
	// =========================================================================
	.use(
		cron({
			name: 'conversation-close',
			pattern: '* * * * *',
			async run() {
				if (env.NODE_ENV === 'test') return;
				try {
					await runConversationCloseCron();
				} catch (error) {
					loggers.app.error({ error }, '❌ [Cron] Erro no backup de fechamento');
					await globalErrorHandler.handle(error, {
						provider: 'cron',
						state: 'runConversationCloseCron_failed',
						extra: { cron: '* * * * *' },
					});
				}
			},
		}),
	)
	.use(
		cron({
			name: 'confirmation-timeout',
			pattern: '*/5 * * * *',
			async run() {
				if (env.NODE_ENV === 'test') return;
				try {
					await runAwaitingConfirmationTimeoutCron();
				} catch (error) {
					loggers.app.error({ error }, '❌ [Cron] Erro no timeout awaiting_confirmation');
					await globalErrorHandler.handle(error, {
						provider: 'cron',
						state: 'runAwaitingConfirmationTimeoutCron_failed',
						extra: { cron: '*/5 * * * *' },
					});
				}
			},
		}),
	)
	// =========================================================================
	// BETTER AUTH plugin (mounts /api/auth + exposes auth macro)
	// =========================================================================
	.use(betterAuthPlugin)
	// =========================================================================
	// ROUTES
	// =========================================================================
	.use(healthRouter)
	.use(webhookRouter)
	.use(itemsRouter)
	.use(dashboardRouter)
	// =========================================================================
	// DEBUG ROUTE (dev only)
	// =========================================================================
	.get(
		'/debug-sentry',
		() => {
			sentryLogger.info('User triggered test error', { action: 'test_error_endpoint' });
			throw new Error('Sentry debug error - testando captura de exceção');
		},
		{
			beforeHandle: () => {
				if (env.NODE_ENV !== 'development') return new Response('Not found', { status: 404 });
			},
		},
	)
	// =========================================================================
	// ROOT
	// =========================================================================
	.get('/', () => ({
		name: 'Nexo AI API',
		version: pkg.version,
		runtime: 'Bun + Elysia',
		docs: '/openapi',
	}))
	// =========================================================================
	// ERROR HANDLER
	// =========================================================================
	.onError(async ({ error, code, set }) => {
		if (code === 'NOT_FOUND') {
			set.status = 404;
			return { error: 'Route not found' };
		}

		if (code === 'VALIDATION') {
			set.status = 422;
			return { error: 'Validation error', details: error.message };
		}

		const errorMessage = error instanceof Error ? error.message : String(error);

		Sentry.captureException(error, {
			tags: { http_status: '500' },
			extra: { errorMessage },
		});

		await globalErrorHandler.handle(error, {
			provider: 'http',
			state: 'request_processing',
		});

		set.status = 500;
		return {
			error: 'Internal server error',
			...(env.NODE_ENV !== 'production' && { message: errorMessage }),
			ref: error instanceof Error ? error.name : 'Unknown',
		};
	});

loggers.app.info('🎯 Bull Board configurado em /admin/queues');
loggers.app.info('✅ Elysia app construída com sucesso');

export default app;
