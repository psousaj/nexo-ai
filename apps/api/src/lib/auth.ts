import { env } from '@/config/env';
import { getRedisClient } from '@/config/redis';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { emailService } from '@/services/email/email.service';
import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

// APP_URL is optional in schema; fallback prevents "undefined/api/auth" bug if not set in prod.
const appBaseURL = env.APP_URL ?? `http://localhost:${env.PORT}`;
const isSecureEnv = env.NODE_ENV === 'production' || env.CORS_ORIGINS.some((o) => o.startsWith('https'));

/**
 * Better Auth secondary storage via Redis.
 * Falls back gracefully: if Redis is unavailable, returns null/void so BA uses DB only.
 */
const buildSecondaryStorage = () => ({
	get: async (key: string) => {
		try {
			const client = await getRedisClient();
			if (!client) return null;
			return await client.get(key);
		} catch {
			return null;
		}
	},
	set: async (key: string, value: string, ttl?: number) => {
		try {
			const client = await getRedisClient();
			if (!client) return;
			if (ttl) {
				await client.set(key, value, 'EX', ttl);
			} else {
				await client.set(key, value);
			}
		} catch {
			// silent — BA falls back to DB
		}
	},
	delete: async (key: string) => {
		try {
			const client = await getRedisClient();
			if (!client) return;
			await client.del(key);
		} catch {
			// silent
		}
	},
});

export const authPlugin = betterAuth({
	secondaryStorage: buildSecondaryStorage(),
	secret: env.BETTER_AUTH_SECRET,
	baseURL: `${appBaseURL}/api/auth`,
	trustedOrigins: env.CORS_ORIGINS,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			user: schema.users,
			session: schema.sessions,
			account: schema.accounts,
			verification: schema.verifications,
		},
	}),
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ['discord', 'google', 'microsoft'],
			allowDifferentEmails: true,
		},
	},

	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // refresh expiry every 1 day of activity
		preserveSessionInDatabase: true, // keep sessions in DB even when Redis is primary
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // 5 min — short to ensure revoked sessions can't linger
			strategy: 'compact' as const,
		},
	},
	advanced: {
		// Secure cookies required in prod (HTTPS) and in dev with HTTPS tunnels (zrok/ngrok).
		useSecureCookies: isSecureEnv,
		// COOKIE_DOMAIN habilita cross-subdomain cookies (ex: .pinheirodev.com.br).
		// Necessário quando dashboard e API estão em subdomínios diferentes do mesmo root.
		// Deixe vazio/ausente em dev ou se os serviços estão em domínios diferentes.
		crossSubDomainCookies: {
			enabled: !!env.COOKIE_DOMAIN,
			domain: env.COOKIE_DOMAIN,
		},
		// @ts-ignore
		cookieOptions: {
			// SameSite=none necessário para cross-origin com credentials:include.
			// Requer Secure=true (garantido por useSecureCookies acima em prod).
			sameSite: isSecureEnv ? 'none' : 'lax',
		},
	},
	emailAndPassword: {
		enabled: true,
	},
	user: {
		additionalFields: {
			role: {
				type: 'string' as const,
				defaultValue: 'user',
			},
		},
		changeEmail: {
			enabled: true,
			sendChangeEmailConfirmation: async ({ user, newEmail, url }: { user: any; newEmail: string; url: string }) => {
				void emailService.sendChangeEmailConfirmation({ user, newEmail, url });
			},
		},
		deleteUser: {
			enabled: true,
			sendDeleteAccountVerification: async ({ user, url }: { user: any; url: string }) => {
				void emailService.sendDeleteAccountVerification({ user, url });
			},
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user, url }) => {
			void emailService.sendEmailVerification({ user, url });
		},
	},
	socialProviders: {
		discord: {
			clientId: env.DISCORD_CLIENT_ID || '',
			clientSecret: env.DISCORD_CLIENT_SECRET || '',
			enabled: !!env.DISCORD_CLIENT_ID,
			permissions: 1126174785006592, // Bot permissions para integração com servidores
			// @ts-ignore
			scopes: ['identify', 'email', 'guilds.join', 'bot'],
		},
		google: {
			clientId: env.GOOGLE_CLIENT_ID || '',
			clientSecret: env.GOOGLE_CLIENT_SECRET || '',
			enabled: !!env.GOOGLE_CLIENT_ID,
			// @ts-ignore
			scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/calendar'],
		},
		microsoft: {
			// @ts-ignore
			clientId: env.MICROSOFT_CLIENT_ID || '',
			// @ts-ignore
			clientSecret: env.MICROSOFT_CLIENT_SECRET || '',
			// @ts-ignore
			enabled: !!env.MICROSOFT_CLIENT_ID,
			// @ts-ignore
			scopes: ['openid', 'email', 'profile', 'Tasks.ReadWrite'],
		},
	},
} satisfies BetterAuthOptions);
