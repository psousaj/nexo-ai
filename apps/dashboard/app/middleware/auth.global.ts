import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware(async (to) => {
	const authStore = useAuthStore();

	// Rotas públicas
	const publicRoutes = ['/login', '/signup'];
	const isPublicRoute = publicRoutes.includes(to.path);

	console.log('🛡️ Auth Middleware:', {
		path: to.path,
		isPublic: isPublicRoute,
		isAuth: authStore.isAuthenticated,
		isLoading: authStore.isLoadingSession,
	});

	// Aguarda o carregamento da sessão se ainda estiver pendente
	if (authStore.isLoadingSession) {
		console.log('⏳ Aguardando carregamento da sessão...');
		let attempts = 0;
		while (authStore.isLoadingSession && attempts < 30) {
			await new Promise((resolve) => setTimeout(resolve, 100));
			attempts++;
		}
		console.log('✅ Sessão carregada após', attempts * 100, 'ms');
	}

	// Se a rota não é pública e o usuário não está autenticado
	if (!isPublicRoute && !authStore.isAuthenticated) {
		console.log('❌ Não autenticado, redirecionando para /login');
		return navigateTo('/login', { replace: true });
	}

	// Se a rota é pública e o usuário está autenticado, redireciona para o dashboard
	if (isPublicRoute && authStore.isAuthenticated) {
		console.log('✅ Já autenticado, redirecionando para /');
		return navigateTo('/', { replace: true });
	}

	console.log('✅ Middleware passou, permitindo acesso');
});
