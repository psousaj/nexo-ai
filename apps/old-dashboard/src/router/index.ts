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
			meta: { public: false },
		},
		{
			path: '/profile',
			name: 'Meu Perfil',
			component: Profile,
			meta: { public: false },
		},
		{
			path: '/preferences',
			name: 'Preferências',
			component: Preferences,
			meta: { public: false },
		},
		{
			path: '/memories',
			name: 'Minhas Memórias',
			component: Memories,
			meta: { public: false },
		},
		{
			path: '/admin/errors',
			name: 'Relatório-de-Erros',
			component: AdminErrors,
			meta: { roles: ['admin'], public: false },
		},
		{
			path: '/admin/conversations',
			name: 'Monitoramento-de-Conversas',
			component: AdminConversations,
			meta: { roles: ['admin'], public: false },
		},
	],
});

router.beforeEach(async (to, _from, next) => {
	const authStore = useAuthStore();

	// Aguarda o carregamento da sessão se ainda estiver pendente
	if (authStore.isLoadingSession) {
		console.log('⏳ Aguardando carregamento da sessão...');
		// Aguarda até 3 segundos para a sessão carregar
		let attempts = 0;
		while (authStore.isLoadingSession && attempts < 30) {
			await new Promise(resolve => setTimeout(resolve, 100));
			attempts++;
		}
		console.log('✅ Sessão carregada:', { isAuthenticated: authStore.isAuthenticated, user: authStore.user?.email });
	}

	if (!to.meta.public && !authStore.isAuthenticated) {
		console.log('🔒 Rota protegida, redirecionando para login');
		return next('/login');
	}

	if (to.meta.public && authStore.isAuthenticated) {
		console.log('✅ Usuário já autenticado, redirecionando para dashboard');
		return next('/');
	}

	// Check roles for admin pages
	if (to.meta.roles && Array.isArray(to.meta.roles)) {
		const userRole = authStore.user?.role || 'user';
		if (!to.meta.roles.includes(userRole)) {
			console.log('⚠️ Usuário sem permissão para acessar rota admin');
			return next('/');
		}
	}

	next();
});

export default router;
