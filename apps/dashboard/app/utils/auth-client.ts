import { createAuthClient } from 'better-auth/vue';
import { env } from '@nexo/env';

const baseURL = env.NUXT_PUBLIC_AUTH_BASE_URL || 'http://localhost:3001';

console.log('🔧 Auth Client baseURL:', baseURL);

export const authClient = createAuthClient({
	baseURL,
	fetchOptions: {
		credentials: 'include',
	},
});

export const { signIn, signOut, signUp, useSession } = authClient;
