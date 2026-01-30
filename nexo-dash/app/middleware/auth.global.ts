import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware(async (to) => {
	if (process.server) return;

	const authStore = useAuthStore();

	// Rotas públicas
	const publicRoutes = ['/login', '/signup'];
	const isPublicRoute = publicRoutes.includes(to.path);

	// Aguarda o carregamento da sessão se ainda estiver pendente
	// Com o novo client, podemos observar o isPending ou isLoadingSession
	if (authStore.isLoadingSession) {
		// Apenas um pequeno wait se necessário ou confiar na reatividade
		// Mas como o watch/computed atualiza, talvez não precise de loop de espera explicito
		// porem para evitar flickering de redirecionamento, podemos esperar um pouco se estiver pending

		// Melhor abordagem: se está loading, mostra loading state na app (via layout)
		// Mas para router guard, se for rota protegida, precisamos saber.

		// Vamos esperar se estiver carregando
		let attempts = 0;
		while (authStore.isLoadingSession && attempts < 10) {
			await new Promise((resolve) => setTimeout(resolve, 50));
			attempts++;
		}
	}

	// Se a rota não é pública e o usuário não está autenticado
	if (!isPublicRoute && !authStore.isAuthenticated) {
		return navigateTo('/login');
	}

	// Se a rota é pública e o usuário está autenticado
	if (isPublicRoute && authStore.isAuthenticated) {
		return navigateTo('/');
	}
});
