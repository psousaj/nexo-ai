import { db } from '@/db';
import { conversations } from '@/db/schema/conversations';
import { messages } from '@/db/schema/messages';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';

export function registerConversationRoutes(app: Hono) {
	app.get('/admin/conversations', async (c) => c.json(await db.select().from(conversations).orderBy(conversations.updatedAt)));
	app.get('/admin/conversations/:id/messages', async (c) => {
		const msgs = await db.select().from(messages).where(eq(messages.conversationId, c.req.param('id')));
		return c.json({ success: true, data: msgs });
	});
}
