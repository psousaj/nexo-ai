import { useAbility } from '@casl/vue';

export default defineNuxtRouteMiddleware((to) => {
	if (process.server) return;

	const { can } = useAbility();
	const authStore = useAuthStore();

	// Rotas admin que requerem verificação
	const adminRoutes = ['/admin/errors', '/admin/conversations', '/admin/users'];
	const isAdminRoute = adminRoutes.some((route) => to.path.startsWith(route));

	if (isAdminRoute) {
		// Check roles for admin pages
		const userRole = authStore.user?.role || 'user';

		// Verifica se pode gerenciar AdminPanel
		if (!can('manage', 'AdminPanel') && userRole !== 'admin') {
			console.log('⚠️ Usuário sem permissão para acessar rota admin');
			return navigateTo('/');
		}
	}
});
