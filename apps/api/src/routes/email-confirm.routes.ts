import { env } from '@/config/env';
import { db } from '@/db';
import { linkingTokens } from '@/db/schema';
import { userEmailService } from '@/services/user-email-service';
import { and, eq, gte } from 'drizzle-orm';
import { Hono } from 'hono';

export const emailConfirmRoutes = new Hono().get('/confirm', async (c) => {
	const dashboardBaseUrl = env.DASHBOARD_URL || 'http://localhost:5173';
	const buildRedirect = (status: 'success' | 'invalid' | 'not_found') => {
		const url = new URL('/confirm-email', dashboardBaseUrl);
		url.searchParams.set('email_confirm', status);
		return c.redirect(url.toString(), 302);
	};

	const token = c.req.query('token');

	if (!token) {
		return buildRedirect('invalid');
	}

	const [record] = await db
		.select()
		.from(linkingTokens)
		.where(
			and(
				eq(linkingTokens.token, token),
				eq(linkingTokens.tokenType, 'email_confirm'),
				gte(linkingTokens.expiresAt, new Date()),
			),
		)
		.limit(1);

	if (!record || !record.externalId) {
		return buildRedirect('invalid');
	}

	const updated = await userEmailService.markEmailAsVerified(record.userId, record.externalId);
	if (!updated) {
		return buildRedirect('not_found');
	}

	await db.delete(linkingTokens).where(eq(linkingTokens.id, record.id));

	return buildRedirect('success');
});
