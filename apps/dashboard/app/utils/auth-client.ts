import { createAuthClient } from 'better-auth/vue';
import { env } from '~/config/env';

export const authClient = createAuthClient({
	baseURL: process.env.NUXT_PUBLIC_AUTH_BASE_URL ?? 'http://localhost:3002/api/auth',
	fetchOptions: {
		credentials: 'include', // Envia cookies em cross-origin
	},
});

export const { signIn, signOut, signUp, useSession } = authClient;
