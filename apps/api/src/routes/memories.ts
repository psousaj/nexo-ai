import { db } from '@/db';
import { memoryEnvelopes } from '@/db/schema/memory-envelopes';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';

export function registerMemoryRoutes(app: Hono) {
	app.get('/memories', async (c) => {
		const userId = c.req.query('userId') ?? 'default';
		const items = await db.select().from(memoryEnvelopes).where(eq(memoryEnvelopes.userId, userId)).orderBy(memoryEnvelopes.createdAt);
		return c.json({ items });
	});

	app.post('/memories', async (c) => {
		const body = await c.req.json();
		const [inserted] = await db.insert(memoryEnvelopes).values({
			userId: body.userId ?? 'default',
			sessionKey: body.sessionKey ?? 'manual',
			sourceKind: body.sourceKind ?? 'manual',
			normalizedContent: body.content ?? body.title ?? '',
			rawArtifact: body.metadata ?? {},
			artifactMetadata: body.metadata ?? {},
			confidence: body.confidence ?? 1,
			relevanceDecay: { decayClass: 'contextual', decayScore: 1, reinforcementCount: 0 },
			audit: { source: 'api' },
		}).returning();
		return c.json(inserted, 201);
	});

	app.patch('/memories/:id', async (c) => {
		const id = c.req.param('id');
		await db.update(memoryEnvelopes).set(await c.req.json()).where(eq(memoryEnvelopes.id, id));
		return c.json({ success: true });
	});

	app.delete('/memories/:id', async (c) => {
		await db.delete(memoryEnvelopes).where(eq(memoryEnvelopes.id, c.req.param('id')));
		return c.json({ success: true });
	});
}
