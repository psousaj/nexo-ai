import { createAuthClient } from 'better-auth/vue';

export const authClient = createAuthClient({
	baseURL: 'http://localhost:3002/api/auth',
});

export const { signIn, signOut, signUp, useSession } = authClient;
