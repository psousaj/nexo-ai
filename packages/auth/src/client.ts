import { createAuthClient } from 'better-auth/vue';

export interface CreateAuthClientOptions {
	baseURL: string;
}

export function createVueAuthClient(options: CreateAuthClientOptions) {
	return createAuthClient({
		baseURL: options.baseURL,
		fetchOptions: {
			credentials: 'include',
		},
	});
}
