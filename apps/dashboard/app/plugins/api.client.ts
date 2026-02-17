import { api } from '~/utils/api';

// Configura a baseURL do axios com o runtimeConfig do Nuxt
// Isso garante que a URL correta seja usada (inclusive túneis zrok/ngrok)
export default defineNuxtPlugin(() => {
	const config = useRuntimeConfig();
	api.defaults.baseURL = config.public.apiUrl as string;
});
