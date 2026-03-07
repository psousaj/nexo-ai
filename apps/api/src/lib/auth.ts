import { env } from '@/config/env';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

// APP_URL is optional in schema; fallback prevents "undefined/api/auth" bug if not set in prod.
const appBaseURL = env.APP_URL ?? `http://localhost:${env.PORT}`;
const isSecureEnv =
	env.NODE_ENV === 'production' || env.CORS_ORIGINS.some((o) => o.startsWith('https'));

export const authPlugin = betterAuth({
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
	user: {
		additionalFields: {
			role: {
				type: 'string',
				defaultValue: 'user',
			},
		},
	},
	session: {
		preserveSessionInDatabase: true,
		cookieCache: {
			enabled: true,
			maxAge: 7 * 24 * 60 * 60, // 7 days
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
