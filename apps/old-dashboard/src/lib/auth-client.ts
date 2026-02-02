import { createAuthClient } from 'better-auth/vue';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const authClient = createAuthClient({
	baseURL: `${apiUrl}/auth`,
	fetchOptions: {
		credentials: 'include',
	},
});

export const { signIn, signUp, signOut, useSession } = authClient;
