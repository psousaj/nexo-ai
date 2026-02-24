import { env } from '@/config/env';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export const authPlugin = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	baseURL: `${env.APP_URL}/api/auth`,
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
		// Usa cookies seguros se a API estiver acessível via HTTPS
		// (produção OU dev com túnel zrok/ngrok)
		useSecureCookies: env.CORS_ORIGINS.some((o) => o.startsWith('https')),
		crossSubDomainCookies: {
			enabled: env.NODE_ENV === 'production',
			domain: env.NODE_ENV === 'production' ? '.crudbox.tech' : undefined,
		},
		// @ts-ignore
		cookieOptions: {
			// 'none' necessário para cross-origin com withCredentials (axios)
			// Requer Secure=true, que é garantido pela linha acima
			sameSite: env.CORS_ORIGINS.some((o) => o.startsWith('https')) ? 'none' : 'lax',
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
