import { createVueAuthClient } from '@nexo/auth/client';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const authClient = createVueAuthClient({
	baseURL: `${apiUrl}/auth`,
});

export const { signIn, signUp, signOut, useSession } = authClient;
