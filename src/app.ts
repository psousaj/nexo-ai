import express, { Express, Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { env as zodEnv } from '@/config/env';
import { healthRouter } from '@/routes/health';
import { webhookRouter } from '@/routes/webhook';
import { itemsRouter } from '@/routes/items';

const app: Express = express();

// Middleware
app.use(express.json());

// Swagger documentation
const swaggerDocument = {
	openapi: '3.0.0',
	info: {
		title: 'Nexo AI API',
		version: '0.1.0',
		description: 'Assistente pessoal via WhatsApp com IA',
	},
};
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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

const PORT = parseInt(zodEnv.PORT);

export default app;
