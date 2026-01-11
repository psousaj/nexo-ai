import { Router, Request, Response } from 'express';

export const healthRouter: Router = Router();

/**
 * GET /health - Health check
 */
healthRouter.get('/health', (req: Request, res: Response) => {
	res.json({
		status: 'ok',
		timestamp: new Date().toISOString(),
	});
});
