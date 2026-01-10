import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { healthRoutes } from '@/routes/health';
import { webhookRoutes } from '@/routes/webhook';
import { itemsRoutes } from '@/routes/items';

const app = new Hono();

// Middleware
app.use('*', logger());

// Routes
app.route('/', healthRoutes);
app.route('/webhook', webhookRoutes);
app.route('/items', itemsRoutes);

// Error handling
app.onError((err, c) => {
	console.error('Error:', err);
	return c.json({ error: err.message || 'Erro interno do servidor' }, 500);
});

// 404 handler
app.notFound((c) => {
	return c.json({ error: 'Rota não encontrada' }, 404);
});

export default app;
