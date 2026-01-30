// import { defineStore } from 'pinia' // Auto-imported
import { authClient } from '~/utils/auth-client';
import { ability } from '~/plugins/casl';

export const useAuthStore = defineStore('auth', () => {
	const session = authClient.useSession();

	const user = computed(() => {
		// Logging for SSR debugging
		if (process.server) {
			console.log('SSR Session State:', {
				value: !!session.value,
				data: !!session.value?.data,
				user: !!session.value?.data?.user,
			});
		}

		// Safer access
		const data = session.value?.data;
		if (!data) return null;
		if (!data.user) return null;

		const u = data.user;
		return {
			id: u.id,
			name: u.name,
			email: u.email,
			image: u.image || '',
			role: (u as any).role || 'user',
			permissions: (u as any).permissions || [],
		};
	});

	const isAuthenticated = computed(() => !!session.value?.data);
	const isLoadingSession = computed(() => session.value?.isPending);

	// Update CASL abilities whenever user changes
	watch(
		() => user.value,
		(newUser) => {
			if (!newUser) {
				ability.update([]);
				return;
			}

			if (newUser.permissions && Array.isArray(newUser.permissions) && newUser.permissions.length > 0) {
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
		await authClient.signOut();
	}

	return {
		user,
		isAuthenticated,
		isLoadingSession,
		logout,
	};
});
