import { defineStore } from 'pinia';
import { computed, watch } from 'vue';
import { ability } from '../plugins/casl';
import { authClient, useSession } from '../lib/auth-client';
import type { User } from '../types';

export const useAuthStore = defineStore('auth', () => {
	const sessionInfo = useSession();

	const user = computed(() => {
		if (!sessionInfo.value?.data) return null;
		const u = sessionInfo.value.data.user;
		return {
			id: u.id,
			name: u.name,
			email: u.email,
			image: u.image || '',
			role: 'user',
		} as User & { role: string };
	});

	const isAuthenticated = computed(() => !!sessionInfo.value?.data);
	const isLoadingSession = computed(() => sessionInfo.value?.isPending);

	// Update CASL abilities whenever user changes
	watch(
		() => user.value,
		(newUser) => {
			ability.update([]); // Reset

			if (newUser?.role === 'admin') {
				ability.update([{ action: 'manage', subject: 'all' }]);
			} else if (newUser?.role === 'user' || newUser) {
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
