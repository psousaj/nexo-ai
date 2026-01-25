import { defineStore } from 'pinia';
import { computed, watch } from 'vue';
import { ability } from '../plugins/casl';
import { authClient, useSession } from '../lib/auth-client';
import type { User } from '../types';

export const useAuthStore = defineStore('auth', () => {
	const sessionInfo = useSession();

	const user = computed(() => {
		if (!sessionInfo.value?.data) return null;
		const u = sessionInfo.value.data.user as any;
		return {
			id: u.id,
			name: u.name,
			email: u.email,
			image: u.image || '',
			role: u.role || 'user',
			permissions: u.permissions || [],
		};
	});

	const isAuthenticated = computed(() => !!sessionInfo.value?.data);
	const isLoadingSession = computed(() => sessionInfo.value?.isPending);

	// Update CASL abilities whenever user changes
	watch(
		() => user.value,
		(newUser) => {
			if (newUser?.permissions && Array.isArray(newUser.permissions)) {
				ability.update(newUser.permissions);
			} else {
				ability.update([]); // Reset or default
				if (newUser) {
					// Fallback for user with no specific permissions in table yet
					ability.update([
						{ action: 'read', subject: 'UserContent' },
						{ action: 'manage', subject: 'PersonalData' },
						{ action: 'read', subject: 'Analytics' },
					]);
				}
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
