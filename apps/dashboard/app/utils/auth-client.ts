import { createAuthClient } from 'better-auth/vue';

// Use runtime config via useRuntimeConfig() no plugin ou composable
// Fallback para variável de ambiente do Nuxt
const baseURL = import.meta.env.NUXT_PUBLIC_AUTH_BASE_URL || 'http://localhost:3001';

console.log('🔧 Auth Client baseURL:', baseURL);

export const authClient = createAuthClient({
	baseURL,
	fetchOptions: {
		credentials: 'include',
	},
});

export const { signIn, signOut, signUp, useSession } = authClient;
