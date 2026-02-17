import { ability } from '~/plugins/casl';

interface BetterAuthUser {
	id: string;
	email: string;
	name: string;
	image?: string;
	role?: string;
	permissions?: any[];
}

export const useAuthStore = defineStore('auth', () => {
	const authClient = useAuthClient();
	const session = authClient.useSession();

	const user = computed(() => {
		const data = session.value?.data;
		if (!data?.user) return null;

		const u = data.user as BetterAuthUser;
		return {
			id: u.id,
			name: u.name,
			email: u.email,
			image: u.image || '',
			role: u.role || 'user',
			permissions: u.permissions || [],
		};
	});

	const isAuthenticated = computed(() => !!session.value?.data);

	const isLoadingSession = computed(() => !!session.value?.isPending);

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

	async function logout() {
		try {
			await authClient.signOut();
			await navigateTo('/login', { replace: true });
		} catch (error) {
			console.error('Logout error:', error);
		}
	}

	return {
		user,
		isAuthenticated,
		isLoadingSession,
		logout,
	};
});
