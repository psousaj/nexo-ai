import { Hono } from 'hono';
import { adminService } from '@/services/admin-service';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const adminRoutes = new Hono()
	.get('/errors', async (c) => {
		const errors = await adminService.getErrorReports();
		return c.json(errors);
	})
	.get('/conversations', async (c) => {
		const conversations = await adminService.getConversationSummaries();
		return c.json(conversations);
	});
