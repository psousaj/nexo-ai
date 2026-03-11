/**
 * Google Calendar Integration Service
 *
 * Handles Google Calendar API operations using OAuth tokens from Better Auth.
 */

import { db } from '@/db';
import { accounts, googleCalendarIntegrations } from '@/db/schema';
import { loggers } from '@/utils/logger';
import { and, eq } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

const logger = loggers.integrations;

/**
 * Google Calendar Event Interface
 */
export interface GoogleCalendarEvent {
	id?: string;
	title: string;
	description?: string;
	startDate: Date;
	endDate?: Date;
	location?: string;
}

/**
 * Get OAuth2 client for a user with auto-refresh
 */
async function getOAuth2Client(userId: string): Promise<OAuth2Client> {
	// Find Google account
	const [account] = await db
		.select()
		.from(accounts)
		.where(and(eq(accounts.providerId, 'google'), eq(accounts.userId, userId)))
		.limit(1);

	if (!account) {
		throw new Error('Conta Google não conectada');
	}

	if (!account.accessToken || !account.refreshToken) {
		throw new Error('Tokens OAuth não encontrados');
	}

	// Check if access token is expired
	const now = new Date();
	const isExpired = account.accessTokenExpiresAt && account.accessTokenExpiresAt <= now;

	// Create OAuth2 client
	const oauth2Client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);

	oauth2Client.setCredentials({
		access_token: account.accessToken,
		refresh_token: account.refreshToken,
	});

	// Refresh token if expired
	if (isExpired) {
		logger.info({ userId }, '🔄 Token expirado, renovando...');

		try {
			const { credentials } = await oauth2Client.refreshAccessToken();

			// Update database with new tokens
			await db
				.update(accounts)
				.set({
					accessToken: credentials.access_token,
					accessTokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
					updatedAt: new Date(),
				})
				.where(eq(accounts.id, account.id));

			logger.info({ userId }, '✅ Token renovado com sucesso');
		} catch (error) {
			logger.error({ userId, err: error }, '❌ Erro ao renovar token');
			throw new Error('Falha ao renovar token de acesso');
		}
	}

	return oauth2Client;
}

/**
 * Get or create Google Calendar integration record
 */
async function getOrCreateIntegration(userId: string): Promise<{ calendarId: string; timezone: string }> {
	const [integration] = await db
		.select()
		.from(googleCalendarIntegrations)
		.where(eq(googleCalendarIntegrations.userId, userId))
		.limit(1);

	if (integration) {
		return {
			calendarId: integration.primaryCalendarId || 'primary',
			timezone: integration.timezone || 'America/Sao_Paulo',
		};
	}

	// Create default integration
	const [newIntegration] = await db
		.insert(googleCalendarIntegrations)
		.values({
			userId,
			primaryCalendarId: 'primary',
			timezone: 'America/Sao_Paulo',
		})
		.returning();

	return {
		calendarId: newIntegration.primaryCalendarId || 'primary',
		timezone: newIntegration.timezone || 'America/Sao_Paulo',
	};
}

/**
 * List calendar events
 */
export async function listCalendarEvents(
	userId: string,
	startDate?: Date,
	endDate?: Date,
	maxResults = 10,
): Promise<
	Array<{
		id: string;
		title: string;
		description?: string;
		start: Date;
		end?: Date;
		location?: string;
	}>
> {
	logger.info({ userId, startDate, endDate, maxResults }, '📅 Listando eventos do Google Calendar');

	try {
		const oauth2Client = await getOAuth2Client(userId);
		const { calendarId } = await getOrCreateIntegration(userId);

		const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

		const now = startDate || new Date();
		const timeMax = endDate || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Default: 7 days

		const response = await calendar.events.list({
			calendarId,
			timeMin: now.toISOString(),
			timeMax: timeMax.toISOString(),
			maxResults,
			singleEvents: true,
			orderBy: 'startTime',
		});

		const events =
			response.data.items?.map((event) => ({
				id: event.id || '',
				title: event.summary || 'Sem título',
				description: event.description ?? undefined,
				start: event.start?.dateTime ? new Date(event.start.dateTime) : new Date(event.start?.date || ''),
				end: event.end?.dateTime
					? new Date(event.end.dateTime)
					: event.end?.date
						? new Date(event.end.date)
						: undefined,
				location: event.location ?? undefined,
			})) || [];

		logger.info({ userId, count: events.length }, '✅ Eventos listados com sucesso');

		return events;
	} catch (error) {
		logger.error({ userId, err: error }, '❌ Erro ao listar eventos');
		throw error;
	}
}

/**
 * Create a calendar event
 */
export async function createCalendarEvent(userId: string, event: GoogleCalendarEvent): Promise<string> {
	logger.info({ userId, title: event.title, startDate: event.startDate }, '📅 Criando evento no Google Calendar');

	try {
		const oauth2Client = await getOAuth2Client(userId);
		const { calendarId, timezone } = await getOrCreateIntegration(userId);

		const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

		// Calculate end date if not provided (default: 1 hour)
		const endDate = event.endDate || new Date(event.startDate.getTime() + 60 * 60 * 1000);

		const eventData = {
			summary: event.title,
			description: event.description,
			start: {
				dateTime: event.startDate.toISOString(),
				timeZone: timezone,
			},
			end: {
				dateTime: endDate.toISOString(),
				timeZone: timezone,
			},
			location: event.location,
		};

		const response = await calendar.events.insert({
			calendarId,
			requestBody: eventData,
		});

		const eventId = response.data.id || '';

		// Update integration sync timestamp
		await db
			.update(googleCalendarIntegrations)
			.set({
				syncedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(googleCalendarIntegrations.userId, userId));

		logger.info({ userId, eventId, title: event.title }, '✅ Evento criado com sucesso');

		return eventId;
	} catch (error) {
		logger.error({ userId, err: error }, '❌ Erro ao criar evento');
		throw error;
	}
}

/**
 * Check if user has connected Google Calendar
 */
export async function hasGoogleCalendarConnected(userId: string): Promise<boolean> {
	try {
		const [account] = await db
			.select()
			.from(accounts)
			.where(and(eq(accounts.providerId, 'google'), eq(accounts.userId, userId)));

		if (!account) return false;

		// Check if calendar scope is present
		return account.scope?.includes('calendar') || false;
	} catch {
		return false;
	}
}

/**
 * Get upcoming events (simplified for AI tools)
 */
export async function getUpcomingEvents(
	userId: string,
	maxResults = 5,
): Promise<
	Array<{
		id: string;
		title: string;
		start: Date;
		end?: Date;
	}>
> {
	const events = await listCalendarEvents(userId, new Date(), undefined, maxResults);

	return events.map((event) => ({
		id: event.id,
		title: event.title,
		start: event.start,
		end: event.end,
	}));
}
