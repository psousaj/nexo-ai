import { createAuthClient } from 'better-auth/vue';
import { env } from '~/config/env';

export const authClient = createAuthClient({
	baseURL: env.NUXT_PUBLIC_AUTH_BASE_URL ?? 'http://localhost:3002/api/auth',
});

export const { signIn, signOut, signUp, useSession } = authClient;
