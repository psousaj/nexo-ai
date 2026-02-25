import { ability } from '~/plugins/casl';
import api from '~/utils/api';

interface BetterAuthUser {
	id: string;
	email: string;
	name: string;
	image?: string;
	emailVerified?: boolean;
	role?: string;
	permissions?: any[];
}

export const useAuthStore = defineStore('auth', () => {
	const authClient = useAuthClient();
	const session = authClient.useSession();
	const profileUser = ref<BetterAuthUser | null>(null);
	const isRefreshingProfile = ref(false);
	let refreshPromise: Promise<void> | null = null;

	const user = computed(() => {
		const data = session.value?.data;
		if (!data?.user) return null;

		const u = {
			...(data.user as BetterAuthUser),
			...(profileUser.value || {}),
		} as BetterAuthUser;
		return {
			id: u.id,
			name: u.name,
			email: u.email,
			image: u.image || '',
			emailVerified: !!u.emailVerified,
			role: u.role || 'user',
			permissions: u.permissions || [],
		};
	});

	const isAuthenticated = computed(() => !!session.value?.data);

	const isLoadingSession = computed(() => !!session.value?.isPending);

	async function refreshProfile() {
		if (import.meta.server) {
			return;
		}

		if (!isAuthenticated.value) {
			profileUser.value = null;
			return;
		}

		if (refreshPromise) {
			await refreshPromise;
			return;
		}

		refreshPromise = (async () => {
			isRefreshingProfile.value = true;
			try {
				const response = await api.get('/user/profile');
				profileUser.value = (response.data?.user || null) as BetterAuthUser | null;
			} catch (error) {
				console.warn('Falha ao sincronizar perfil do usuário:', error);
			} finally {
				isRefreshingProfile.value = false;
			}
		})();

		await refreshPromise;
		refreshPromise = null;
	}

	watch(
		() => user.value,
		(newUser) => {
			if (!newUser) {
				ability.update([]);
				return;
			}
			if (newUser.permissions?.length) {
				ability.update(newUser.permissions);
				return;
			}
			if (newUser.role === 'admin') {
				ability.update([{ action: 'manage', subject: 'all' }]);
			} else {
				ability.update([
					{ action: 'read', subject: 'UserContent' },
					{ action: 'manage', subject: 'PersonalData' },
					{ action: 'read', subject: 'Analytics' },
				]);
			}
		},
		{ immediate: true },
	);

	watch(
		() => isAuthenticated.value,
		(isAuth) => {
			if (!isAuth) {
				profileUser.value = null;
			}
		},
		{ immediate: true },
	);

	async function logout() {
		try {
			await authClient.signOut();
			profileUser.value = null;
			await navigateTo('/login', { replace: true });
		} catch (error) {
			console.error('Logout error:', error);
		}
	}

	return {
		user,
		isAuthenticated,
		isLoadingSession,
		isRefreshingProfile,
		refreshProfile,
		logout,
	};
});
