import express, { Express, Request, Response, NextFunction } from 'express';
import { healthRouter } from '@/routes/health';
import { webhookRouter } from '@/routes/webhook';
import { itemsRouter } from '@/routes/items';

const app: Express = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use(healthRouter);
app.use('/webhook', webhookRouter);
app.use('/items', itemsRouter);

// Error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
	console.error('Error:', err);
	res.status(err.status || 500).json({
		error: err.message || 'Erro interno do servidor',
	});
});

// 404 handler
app.use((req: Request, res: Response) => {
	res.status(404).json({ error: 'Rota não encontrada' });
});

export default app;
