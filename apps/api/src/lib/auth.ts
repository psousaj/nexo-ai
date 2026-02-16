import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { env } from '@/config/env';

export const authPlugin = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	trustedOrigins: env.NODE_ENV === 'development' ? ['http://localhost:5173', `http://localhost:${env.PORT}`] : env.CORS_ORIGINS,
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
		useSecureCookies: env.NODE_ENV === 'production',
		crossSubDomainCookies: {
			enabled: true,
			// ⚠️ IMPORTANTE: Deve ser apenas o domínio raiz com ponto, NÃO a URL completa
			// Produção: '.crudbox.tech' | Dev: undefined (desabilitado)
			domain: env.NODE_ENV === 'production' ? '.crudbox.tech' : undefined,
		},
		cookieOptions: {
			sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax', // none para cross-origin em prod
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
			scopes: ['identify', 'email', 'guilds.join', 'bot'],
		},
		google: {
			clientId: env.GOOGLE_CLIENT_ID || '',
			clientSecret: env.GOOGLE_CLIENT_SECRET || '',
			enabled: !!env.GOOGLE_CLIENT_ID,
		},
	},
} satisfies BetterAuthOptions);
