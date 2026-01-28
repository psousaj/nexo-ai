import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { env } from '@/config/env';

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	trustedOrigins: env.NODE_ENV === 'development' ? ['http://localhost:5173', 'http://localhost:3000'] : env.CORS_ORIGINS,
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
		cookie: {
			sameSite: 'none',
			secure: env.NODE_ENV === 'production',
		},
		cookieCache: {
			enabled: true,
			maxAge: 1 * 60 * 60, // 1 hour
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
});
