import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { env } from '@/config/env';

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	trustedOrigins: [
		'http://localhost:5173',
		'http://localhost:5174',
		'http://127.0.0.1:5173',
		'http://127.0.0.1:5174',
		'http://localhost:3000',
	],
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
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // 5 minutes
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
		},
		google: {
			clientId: env.GOOGLE_CLIENT_ID || '',
			clientSecret: env.GOOGLE_CLIENT_SECRET || '',
			enabled: !!env.GOOGLE_CLIENT_ID,
		},
	},
	// HOOKS DESABILITADOS TEMPORARIAMENTE - Better Auth 1.4.17 tem bug com Hono
	// Ver: https://github.com/better-auth/better-auth/issues/xxx
	// TODO: Reativar quando Better Auth 1.5.x for lançado ou usar plugin específico
	// hooks: {
	// 	before: async (context) => {
	// 		// Hook de linking OAuth com usuário existente
	// 	},
	// 	after: async (context) => {
	// 		// Hook de sincronização user_accounts e user_emails
	// 	},
	// },
});