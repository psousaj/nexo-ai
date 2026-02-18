import { createAuthClient } from 'better-auth/vue';

export default defineNuxtPlugin(() => {
	const config = useRuntimeConfig();
	const baseURL = config.public.authBaseUrl as string;

	const authClient = createAuthClient({
		baseURL,
		fetchOptions: {
			credentials: 'include',
		},
	});

	return {
		provide: {
			authClient,
		},
	};
});

declare module '#app' {
	interface NuxtApp {
		$authClient: ReturnType<typeof createAuthClient>;
	}
}
