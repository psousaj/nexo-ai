import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../store/auth';
import Dashboard from '../views/DashboardView.vue';
import Profile from '../views/ProfileView.vue';
import Preferences from '../views/PreferencesView.vue';
import Memories from '../views/MemoriesView.vue';
import AdminErrors from '../views/AdminErrorsView.vue';
import AdminConversations from '../views/AdminConversationsView.vue';

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: '/',
			name: 'Dashboard',
			component: Dashboard,
			meta: { roles: ['admin', 'user'] },
		},
		{
			path: '/profile',
			name: 'Meu Perfil',
			component: Profile,
			meta: { roles: ['admin', 'user'] },
		},
		{
			path: '/preferences',
			name: 'Preferências',
			component: Preferences,
			meta: { roles: ['admin', 'user'] },
		},
		{
			path: '/memories',
			name: 'Minhas Memórias',
			component: Memories,
			meta: { roles: ['admin', 'user'] },
		},
		{
			path: '/admin/errors',
			name: 'Relatório-de-Erros',
			component: AdminErrors,
			meta: { roles: ['admin'] },
		},
		{
			path: '/admin/conversations',
			name: 'Monitoramento-de-Conversas',
			component: AdminConversations,
			meta: { roles: ['admin'] },
		},
	],
});

router.beforeEach((to, _from, next) => {
	const authStore = useAuthStore();

	// Check if the route requires a specific role
	if (to.meta.roles && Array.isArray(to.meta.roles)) {
		const userRole = authStore.user?.role || 'user';
		if (!to.meta.roles.includes(userRole)) {
			console.warn(`Acesso negado: Rota ${to.path} requer permissão de ${to.meta.roles.join('/')}`);
			return next('/');
		}
	}

	next();
});

export default router;
