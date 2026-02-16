import { createAuthClient } from 'better-auth/vue';

const baseURL = process.env.NUXT_PUBLIC_AUTH_BASE_URL ?? 'http://localhost:3001/api/auth';

console.log('🔧 Auth Client configurado com baseURL:', baseURL);

export const authClient = createAuthClient({
	baseURL,
	fetchOptions: {
		credentials: 'include',
	},
});

export const { signIn, signOut, signUp, useSession } = authClient;
