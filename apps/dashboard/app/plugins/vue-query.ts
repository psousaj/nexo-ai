import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';

export default defineNuxtPlugin((nuxtApp) => {
	// Modify your Vue Query global settings here
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 5000,
				refetchOnWindowFocus: false,
			},
		},
	});

	nuxtApp.vueApp.use(VueQueryPlugin, { queryClient });
});
