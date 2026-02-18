/**
 * Retorna a instância do authClient criada no plugin `auth.client.ts`
 * com a baseURL correta vinda do runtimeConfig do Nuxt.
 *
 * Funciona apenas no client (SSR desabilitado no dashboard).
 */
export const useAuthClient = () => {
	return useNuxtApp().$authClient;
};
