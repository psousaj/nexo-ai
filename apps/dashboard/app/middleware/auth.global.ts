import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware(async (to) => {
	const authStore = useAuthStore();
	const publicRoutes = ['/login', '/signup', '/confirm-email'];
	const isPublicRoute = publicRoutes.includes(to.path);

	// Aguarda sessão carregar (tipicamente <300ms com cookieCache habilitado na API)
	if (authStore.isLoadingSession) {
		await new Promise<void>((resolve) => {
			const stop = watch(
				() => authStore.isLoadingSession,
				(loading) => {
					if (!loading) {
						stop();
						resolve();
					}
				},
			);
			setTimeout(() => {
				stop();
				resolve();
			}, 3000);
		});
	}

	// Rota protegida sem sessão → redireciona para login, preservando destino
	if (!isPublicRoute && !authStore.isAuthenticated) {
		const callbackUrl = to.fullPath !== '/' ? encodeURIComponent(to.fullPath) : undefined;
		return navigateTo(callbackUrl ? `/login?callbackUrl=${callbackUrl}` : '/login', { replace: true });
	}

	const currentUser = authStore.user;
	const isEmailUnverified = !!(authStore.isAuthenticated && currentUser && !currentUser.emailVerified);

	if (isEmailUnverified && to.path !== '/confirm-email') {
		return navigateTo('/confirm-email', { replace: true });
	}

	// Rota pública com sessão ativa → redireciona para callbackUrl ou dashboard
	if (isPublicRoute && authStore.isAuthenticated && to.path !== '/confirm-email') {
		const callbackUrl = (to.query.callbackUrl as string) || '/';
		return navigateTo(callbackUrl, { replace: true });
	}
});
