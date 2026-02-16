import { createAuthClient } from 'better-auth/vue';

// Nuxt expõe NUXT_PUBLIC_* vars via import.meta.env (Vite) no client-side
// Importante: baseURL é apenas a ORIGIN (sem /api/auth) — Better Auth adiciona automaticamente
const baseURL = import.meta.env.NUXT_PUBLIC_AUTH_BASE_URL || 'http://localhost:3001';

console.log('🔧 Auth Client baseURL:', baseURL);

export const authClient = createAuthClient({
	baseURL,
	fetchOptions: {
		credentials: 'include',
	},
});

export const { signIn, signOut, signUp, useSession } = authClient;
