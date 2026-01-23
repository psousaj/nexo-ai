import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../store/auth';
import Dashboard from '../views/DashboardView.vue';
import Profile from '../views/ProfileView.vue';
import Preferences from '../views/PreferencesView.vue';
import Memories from '../views/MemoriesView.vue';
import AdminErrors from '../views/AdminErrorsView.vue';
import AdminConversations from '../views/AdminConversationsView.vue';
import Login from '../views/LoginView.vue';
import Signup from '../views/SignupView.vue';

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: '/login',
			name: 'Login',
			component: Login,
			meta: { public: true },
		},
		{
			path: '/signup',
			name: 'Cadastro',
			component: Signup,
			meta: { public: true },
		},
		{
			path: '/',
			name: 'Dashboard',
			component: Dashboard,
		},
		{
			path: '/profile',
			name: 'Meu Perfil',
			component: Profile,
		},
		{
			path: '/preferences',
			name: 'Preferências',
			component: Preferences,
		},
		{
			path: '/memories',
			name: 'Minhas Memórias',
			component: Memories,
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

router.beforeEach(async (to, _from, next) => {
	const authStore = useAuthStore();

	// Wait for session to load if it's pending
	// In a real app we might show a splash screen

	if (!to.meta.public && !authStore.isAuthenticated) {
		return next('/login');
	}

	if (to.meta.public && authStore.isAuthenticated) {
		return next('/');
	}

	// Check roles for admin pages
	if (to.meta.roles && Array.isArray(to.meta.roles)) {
		const userRole = authStore.user?.role || 'user';
		if (!to.meta.roles.includes(userRole)) {
			return next('/');
		}
	}

	next();
});

export default router;
