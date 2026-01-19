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
} from '@/services/queue-service';
import pkg from '../package.json';
import cron from 'node-cron';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { HonoAdapter } from '@bull-board/hono';
import { serveStatic } from '@hono/node-server/serve-static';

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
	queues: [new BullAdapter(messageQueue), new BullAdapter(closeConversationQueue)],
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
}

// Error Handler
app.onError((error, c) => {
	const errorMessage = error instanceof Error ? error.message : String(error);
	const errorStack = error instanceof Error ? error.stack : undefined;

	console.error('[ERROR]', { message: errorMessage, stack: errorStack });

	// Not found handlers are usually handled separately in Hono, but internal errors go here
	const status = 500;
	return c.json(
		{
			error: 'Internal server error',
			...(env.NODE_ENV !== 'production' && { message: errorMessage }),
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
