import { getApiEnv } from '@/config/env';
import { registerRoutes } from '@/routes';
import * as Sentry from '@sentry/node';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger as honoLogger } from 'hono/logger';

const app = new Hono();
const apiEnv = getApiEnv();

app.use(
	'*',
	cors({
		origin: (origin) => {
			if (apiEnv.NODE_ENV === 'development') return origin || '*';
			return apiEnv.CORS_ORIGINS.includes(origin || '') ? origin : undefined;
		},
		credentials: true,
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
		allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
		exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
		maxAge: 600,
	}),
);

app.use('*', honoLogger());

app.use('*', async (c, next) => {
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

registerRoutes(app);

app.notFound((c) => c.json({ error: 'Route not found' }, 404));

app.onError(async (error, c) => {
	if (error instanceof HTTPException) {
		if (apiEnv.NODE_ENV === 'development') {
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

	Sentry.captureException(error, {
		tags: { http_status: '500' },
		extra: {
			method: c.req.method,
			url: c.req.url,
			path: c.req.path,
		},
	});

	const status = 500;
	return c.json(
		{
			error: 'Internal server error',
			...(apiEnv.NODE_ENV !== 'production' && { message: error.message }),
		},
		status,
	);
});

export default app;
