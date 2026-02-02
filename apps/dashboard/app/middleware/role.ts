import { useAuthStore } from '~/stores/auth';

export default defineNuxtRouteMiddleware((to) => {
	const authStore = useAuthStore();

	// Required permissions/roles for specific routes
	// For now, only /admin routes require admin role
	if (to.path.startsWith('/admin')) {
		const user = authStore.user;
		const isAdmin = user?.role === 'admin';

		if (!isAdmin) {
			console.warn('🔒 Admin route access denied for user:', user?.email);
			return navigateTo('/', { replace: true });
		}
	}
});
