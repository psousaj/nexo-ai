import { createVueAuthClient } from '@nexo/auth/client';

export const authClient = createVueAuthClient({
	baseURL: process.env.NUXT_PUBLIC_AUTH_BASE_URL ?? 'http://localhost:3002/api/auth',
});

export const { signIn, signOut, signUp, useSession } = authClient;
