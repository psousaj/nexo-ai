import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware(async (to) => {
	const authStore = useAuthStore();

	// Rotas públicas
	const publicRoutes = ['/login', '/signup'];
	const isPublicRoute = publicRoutes.includes(to.path);

	// Aguarda o carregamento da sessão se ainda estiver pendente
	if (authStore.isLoadingSession) {
		let attempts = 0;
		while (authStore.isLoadingSession && attempts < 20) {
			await new Promise((resolve) => setTimeout(resolve, 50));
			attempts++;
		}
	}

	// Se a rota não é pública e o usuário não está autenticado
	if (!isPublicRoute && !authStore.isAuthenticated) {
		return navigateTo('/login', { replace: true });
	}

	// Se a rota é pública e o usuário está autenticado, redireciona para o dashboard
	if (isPublicRoute && authStore.isAuthenticated) {
		return navigateTo('/', { replace: true });
	}
});
