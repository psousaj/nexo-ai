import { db } from '@/db';
import { userPreferences } from '@/db/schema/user-preferences';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';

export function registerPreferencesRoutes(app: Hono) {
	app.get('/user/preferences', async (c) => {
		const [prefs] = await db
			.select()
			.from(userPreferences)
			.where(eq(userPreferences.userId, c.req.query('userId') ?? 'default'))
			.limit(1);
		return c.json(prefs ?? {});
	});

	app.patch('/user/preferences', async (c) => {
		const userId = c.req.query('userId') ?? 'default';
		const body = await c.req.json();
		const [existing] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
		if (existing) {
			await db.update(userPreferences).set(body).where(eq(userPreferences.userId, userId));
		} else {
			await db.insert(userPreferences).values({ userId, ...body });
		}
		return c.json({ success: true });
	});
}
