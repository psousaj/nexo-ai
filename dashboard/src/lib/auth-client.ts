import { createAuthClient } from 'better-auth/vue';

export const authClient = createAuthClient({
	baseURL: 'http://localhost:3002', // API URL
});

export const { signIn, signUp, signOut, useSession } = authClient;
