import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from '@/config/env';
import { healthRouter } from '@/routes/health';
import { webhookRoutes as webhookRouter } from '@/routes/webhook-new';
import { itemsRouter } from '@/routes/items';
import {
	runConversationCloseCron,
	runAwaitingConfirmationTimeoutCron,
	messageQueue,
	closeConversationQueue,
	responseQueue
} from '@/services/queue-service';
import pkg from '../package.json';
import cron from 'node-cron';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { HonoAdapter } from '@bull-board/hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { globalErrorHandler } from '@/services/error/error.service';

const app = new Hono();

// CORS
app.use('*', cors());

// ============================================================================
// BULL BOARD - Dashboard para filas
// ============================================================================
console.log('🎯 Configurando Bull Board...');

// Criar adapter COM serveStatic (necessário!)
const serverAdapter = new HonoAdapter(serveStatic);

// Criar Bull Board com as filas
createBullBoard({
	queues: [new BullAdapter(messageQueue), new BullAdapter(closeConversationQueue), new BullAdapter(responseQueue)],
	serverAdapter,
});

// Configurar base path
serverAdapter.setBasePath('/admin/queues');

// IMPORTANTE: Registrar antes de outras rotas
app.route('/admin/queues', serverAdapter.registerPlugin());

console.log('✅ Bull Board configurado em http://localhost:3000/admin/queues');

// ============================================================================
// CRON JOBS - Fechamento automático de conversas
// ============================================================================
if (env.NODE_ENV !== 'test') {
	// A cada 1 minuto
	cron.schedule('* * * * *', async () => {
		try {
			await runConversationCloseCron();
		} catch (error) {
			console.error('❌ [Cron] Erro no backup de fechamento:', error);
		}
	});

	// A cada 5 minutos
	cron.schedule('*/5 * * * *', async () => {
		try {
			await runAwaitingConfirmationTimeoutCron();
		} catch (error) {
			console.error('❌ [Cron] Erro no timeout awaiting_confirmation:', error);
		}
	});

	// Relatório Diário de Erros (09:00 AM)
	cron.schedule('0 9 * * *', async () => {
		const { errorReportService } = await import('@/services/error/error-report-email');
		await errorReportService.sendDailyReport();
	});
}

// Error Handler
// Error Handler
app.onError(async (error, c) => {
	const errorMessage = error instanceof Error ? error.message : String(error);

	// Captura erro globalmente com contexto HTTP
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

// Root point for compatibility/version check
app.get('/', (c) =>
	c.json({
		name: 'Nexo AI API',
		version: pkg.version,
		description: 'Assistente pessoal via WhatsApp/Telegram com IA',
	}),
);

export default app;
