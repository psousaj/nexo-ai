import { env } from '@/config/env';
import { authRouter } from '@/routes/auth-better.routes';
import { dashboardRouter } from '@/routes/dashboard';
import { emailConfirmRoutes } from '@/routes/email-confirm.routes';
import { healthRouter } from '@/routes/health';
import { itemsRouter } from '@/routes/items';
import { webhookRoutes as webhookRouter } from '@/routes/webhook-new';
import { sentryLogger } from '@/sentry';
import { globalErrorHandler } from '@/services/error/error.service';
import {
	closeConversationQueue,
	enrichmentQueue,
	messageQueue,
	responseQueue,
	runAwaitingConfirmationTimeoutCron,
	runConversationCloseCron,
} from '@/services/queue-service';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { HonoAdapter } from '@bull-board/hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { swaggerUI } from '@hono/swagger-ui';
import { apiReference } from '@scalar/hono-api-reference';
import * as Sentry from '@sentry/node';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import cron from 'node-cron';
import pkg from '../package.json';
import { loggers } from './utils/logger';

const app = new Hono();

// CORS - Origins definidas em CORS_ORIGINS (separadas por vírgula)
// Em dev: permite qualquer origem (útil para túneis zrok/ngrok)
app.use(
	'*',
	cors({
		origin: (origin) => {
			// Em desenvolvimento, aceita qualquer origem
			if (env.NODE_ENV === 'development') {
				return origin || '*';
			}
			// Em produção, valida contra CORS_ORIGINS
			return env.CORS_ORIGINS.includes(origin || '') ? origin : undefined;
		},
		credentials: true,
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
		allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
		exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
		maxAge: 600,
	}),
);

// Logger HTTP - Log de todas as requisições
app.use('*', logger());

// ============================================================================
// SENTRY - Error tracking & contexto HTTP
// ============================================================================
// Middleware para capturar contexto da requisição e usuário
app.use('*', async (c, next) => {
	// Captura informações da requisição para breadcrumbs
	Sentry.addBreadcrumb({
		category: 'http',
		message: `${c.req.method} ${c.req.url}`,
		level: 'info',
		data: {
			method: c.req.method,
			url: c.req.url,
			path: c.req.path,
		},
	});

	return next();
});

// ============================================================================
// BULL BOARD - Dashboard para filas
// ============================================================================
loggers.app.info('🎯 Configurando Bull Board...');

// Criar adapter COM serveStatic (necessário!)
const serverAdapter = new HonoAdapter(serveStatic);

// Criar Bull Board com as filas
createBullBoard({
	queues: [
		new BullAdapter(messageQueue),
		new BullAdapter(closeConversationQueue),
		new BullAdapter(responseQueue),
		new BullAdapter(enrichmentQueue),
	],
	serverAdapter,
});

// Configurar base path
serverAdapter.setBasePath('/admin/queues');

// IMPORTANTE: Registrar antes de outras rotas
app.route('/admin/queues', serverAdapter.registerPlugin());

loggers.app.info(`✅ Bull Board configurado em http://localhost:${env.PORT}/admin/queues`);

// ============================================================================
// CRON JOBS - Fechamento automático de conversas
// ============================================================================
if (env.NODE_ENV !== 'test') {
	// A cada 1 minuto
	cron.schedule('* * * * *', async () => {
		try {
			await runConversationCloseCron();
		} catch (error) {
			loggers.app.error({ error }, '❌ [Cron] Erro no backup de fechamento');
		}
	});

	// A cada 5 minutos
	cron.schedule('*/5 * * * *', async () => {
		try {
			await runAwaitingConfirmationTimeoutCron();
		} catch (error) {
			loggers.app.error({ error }, '❌ [Cron] Erro no timeout awaiting_confirmation');
		}
	});
}

// Error Handler
// Error Handler
app.onError(async (error, c) => {
	// Captura erros HTTP (4xx) - apenas loga, não envia para Sentry em produção
	if (error instanceof HTTPException) {
		// Em desenvolvimento, pode ser útil ver erros HTTP no Sentry
		if (env.NODE_ENV === 'development') {
			Sentry.captureException(error, {
				tags: { http_status: String(error.status) },
				extra: {
					method: c.req.method,
					url: c.req.url,
					path: c.req.path,
				},
			});
		}
		return error.getResponse();
	}

	// Erros internos (5xx) sempre vão para o Sentry
	const errorMessage = error instanceof Error ? error.message : String(error);

	// Captura erro no Sentry com contexto HTTP
	Sentry.captureException(error, {
		tags: {
			http_status: '500',
			route: c.req.routePath || c.req.path,
		},
		extra: {
			method: c.req.method,
			url: c.req.url,
			path: c.req.path,
			query: c.req.query(),
			headers: {
				'user-agent': c.req.header('user-agent'),
			},
		},
	});

	// Captura erro globalmente com contexto HTTP (serviço existente)
	await globalErrorHandler.handle(error, {
		provider: 'http',
		state: 'request_processing',
		extra: {
			method: c.req.method,
			url: c.req.url,
			path: c.req.path,
		},
	});

	// Not found handlers are usually handled separately in Hono, but internal errors go here
	const status = 500;
	return c.json(
		{
			error: 'Internal server error',
			...(env.NODE_ENV !== 'production' && { message: errorMessage }),
			ref: error instanceof Error ? error.name : 'Unknown',
		},
		status,
	);
});

// Routes
app.route('/health', healthRouter);
app.route('/webhook', webhookRouter);
app.route('/items', itemsRouter);
app.route('/api/auth', authRouter);
app.route('/api/emails', emailConfirmRoutes);
app.route('/api', dashboardRouter);

// Debug route para testar Sentry (apenas em desenvolvimento)
if (env.NODE_ENV === 'development') {
	app.get('/debug-sentry', () => {
		// Envia um log antes de lançar o erro (conforme documentação)
		sentryLogger.info('User triggered test error', {
			action: 'test_error_endpoint',
		});

		// Envia uma métrica de teste (conforme documentação)
		Sentry.metrics.count('debug_sentry_test_counter', 1, {
			attributes: {
				route: '/debug-sentry',
				environment: env.NODE_ENV,
			},
		});

		throw new Error('Sentry debug error - testando captura de exceção');
	});
}

app.get('/', (c) =>
	c.json({
		name: 'Nexo AI API',
		version: pkg.version,
		description: 'Assistente pessoal via WhatsApp/Telegram com IA',
		docs: '/doc',
		scalar: '/scalar',
	}),
);

// OpenAPI Spec
app.get('/openapi.json', (c) => {
	return c.json({
		openapi: '3.0.0',
		info: {
			title: 'Nexo AI API',
			version: pkg.version,
			description: 'API do assistente pessoal Nexo AI',
		},
		paths: {
			'/health': {
				get: {
					summary: 'Verifica saúde da API',
					responses: { 200: { description: 'OK' } },
				},
			},
			'/api/auth/*': {
				summary: 'Endpoints de Autenticação (Better Auth)',
			},
			'/items': {
				get: {
					summary: 'Lista itens do usuário',
					parameters: [{ name: 'userId', in: 'query', required: true, schema: { type: 'string' } }],
				},
			},
		},
	});
});

// Documentation UIs
app.get('/doc', swaggerUI({ url: '/openapi.json' }));
app.get(
	'/scalar',
	apiReference({
		spec: {
			url: '/openapi.json',
		},
	} as any),
);

export default app;
