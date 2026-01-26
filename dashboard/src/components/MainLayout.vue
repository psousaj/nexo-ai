<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../store/auth';
import {
	LayoutDashboard,
	Database,
	MessageSquare,
	Users,
	Settings,
	Menu,
	X,
	LogOut,
	Bell,
	AlertCircle,
	ShieldCheck,
	UserCircle,
	Link as LinkIcon,
} from 'lucide-vue-next';
import { useAbility } from '@casl/vue';

const isOpen = ref(true);
const toggleSidebar = () => (isOpen.value = !isOpen.value);

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const { can } = useAbility();

const menuItems = computed(() => {
	const allItems = [
		{ name: 'Dashboard', icon: LayoutDashboard, path: '/', subject: 'Analytics', action: 'read' },
		{ name: 'Minhas Memórias', icon: Database, path: '/memories', subject: 'UserContent', action: 'read' },
		{ name: 'Preferências', icon: Settings, path: '/preferences', subject: 'PersonalData', action: 'manage' },
		{ name: 'Perfil', icon: UserCircle, path: '/profile', subject: 'PersonalData', action: 'manage' },
		{ name: 'Usuários', icon: Users, path: '/admin/users', subject: 'AdminPanel', action: 'manage' }, // Just as example
		{ name: 'Conversas', icon: MessageSquare, path: '/admin/conversations', subject: 'AdminPanel', action: 'manage' },
		{ name: 'Erros', icon: AlertCircle, path: '/admin/errors', subject: 'AdminPanel', action: 'manage' },
	];

	// Filter based on CASL abilities
	return allItems.filter((item) => can(item.action, item.subject));
});

const handleLogout = () => {
	authStore.logout();
	router.push('/login');
};
</script>

<template>
	<div class="flex h-screen bg-surface-50 dark:bg-surface-950 transition-colors duration-300">
		<!-- Mobile Sidebar Backdrop -->
		<div v-if="isOpen" @click="toggleSidebar" class="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden transition-opacity"></div>

		<!-- Sidebar -->
		<aside
			:class="[
				'fixed inset-y-0 left-0 z-50 transition-all duration-300 transform lg:static lg:translate-x-0 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 flex flex-col shadow-lg lg:shadow-none',
				isOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0',
			]"
		>
			<!-- Logo Area -->
			<div class="h-16 flex items-center px-6 border-b border-surface-200 dark:border-surface-800">
				<div class="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shrink-0 shadow-sm shadow-primary-600/30">
					<span class="text-white font-bold">N</span>
				</div>
				<span v-if="isOpen" class="ml-3 font-bold text-xl text-surface-900 dark:text-white transition-opacity duration-300">
					Nexo<span class="text-primary-600">AI</span>
				</span>
			</div>

			<!-- User Persona Switcher -->
			<div v-if="isOpen" class="px-4 py-4">
				<button
					@click="authStore.toggleRole()"
					class="w-full flex items-center gap-3 px-3 py-2 bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-800 hover:border-primary-500 transition-all group"
				>
					<div class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center">
						<ShieldCheck v-if="can('manage', 'AdminPanel')" class="w-4 h-4" />
						<UserCircle v-else class="w-4 h-4" />
					</div>
					<div class="flex-1 text-left overflow-hidden">
						<p class="text-sm font-semibold text-surface-900 dark:text-white truncate">Trocar Modo</p>
						<p class="text-[10px] text-surface-500 uppercase tracking-wider">
							{{ can('manage', 'AdminPanel') ? 'Administrador' : 'Usuário' }}
						</p>
					</div>
				</button>
			</div>

			<!-- Navigation -->
			<nav class="flex-1 overflow-y-auto p-4 space-y-1">
				<router-link v-for="item in menuItems" :key="item.name" :to="item.path" v-slot="{ isActive }" class="block">
					<div
						:class="[
							'flex items-center px-3 py-2 rounded-lg transition-all duration-200 group relative',
							isActive
								? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 font-medium'
								: 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-white',
						]"
					>
						<component :is="item.icon" :class="['w-5 h-5 shrink-0', isActive ? '' : '']" />
						<span v-if="isOpen" class="ml-3 whitespace-nowrap text-sm">{{ item.name }}</span>

						<!-- Tooltip for closed sidebar -->
						<div
							v-if="!isOpen"
							class="absolute left-14 bg-surface-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl"
						>
							{{ item.name }}
						</div>
					</div>
				</router-link>
			</nav>

			<!-- Footer Action -->
			<div class="p-4 border-t border-surface-200 dark:border-surface-800">
				<button
					@click="handleLogout"
					class="flex items-center w-full px-3 py-2 text-surface-600 dark:text-surface-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors font-medium"
				>
					<LogOut class="w-5 h-5" />
					<span v-if="isOpen" class="ml-3 text-sm">Sair</span>
				</button>
			</div>
		</aside>

		<!-- Main Content -->
		<div class="flex-1 flex flex-col overflow-hidden relative">
			<!-- Top Header -->
			<header
				class="h-16 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between px-6 sticky top-0 z-30"
			>
				<div class="flex items-center gap-4">
					<button
						@click="toggleSidebar"
						class="p-2 -ml-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400"
					>
						<Menu v-if="!isOpen" class="w-5 h-5" />
						<X v-else class="w-5 h-5" />
					</button>
					<h1 class="text-xl font-semibold text-surface-900 dark:text-white hidden md:block">
						{{ route.name?.toString().replace('-', ' ') || 'Nexo AI' }}
					</h1>
				</div>

				<div class="flex items-center gap-3">
					<!-- Role Indicator -->
					<div
						v-if="can('manage', 'AdminPanel')"
						class="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-bold uppercase tracking-widest border border-amber-200 dark:border-amber-800/50"
					>
						<ShieldCheck class="w-3 h-3" />
						Admin
					</div>

					<button class="p-2 rounded-full hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400 relative">
						<Bell class="w-5 h-5" />
						<span class="absolute top-2 right-2 w-2 h-2 bg-primary-600 rounded-full border-2 border-white dark:border-surface-900"></span>
					</button>

					<div class="h-6 w-[1px] bg-surface-200 dark:bg-surface-800 mx-1"></div>

					<router-link to="/profile" class="flex items-center gap-3 pl-1 group">
						<div class="text-right hidden sm:block">
							<p class="text-sm font-bold text-surface-900 dark:text-white group-hover:text-primary-600 transition-colors">
								{{ authStore.user?.name }}
							</p>
							<p class="text-[10px] text-surface-500 font-medium">{{ authStore.user?.email }}</p>
						</div>
						<div
							class="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-blue-500 flex items-center justify-center text-white font-black ring-2 ring-white dark:ring-surface-900 shadow-lg group-hover:scale-105 transition-transform"
						>
							{{ authStore.user?.name?.charAt(0) }}
						</div>
					</router-link>
				</div>
			</header>

			<!-- Page Content -->
			<main class="flex-1 overflow-y-auto p-4 md:p-8 bg-surface-50 dark:bg-surface-950/50">
				<slot />
			</main>
		</div>
	</div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
	transition:
		opacity 0.2s ease,
		transform 0.2s ease;
}

.fade-enter-from {
	opacity: 0;
	transform: translateY(10px);
}

.fade-leave-to {
	opacity: 0;
	transform: translateY(-10px);
}
</style>
