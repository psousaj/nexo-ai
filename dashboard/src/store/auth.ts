import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { ability } from '../plugins/casl';
import type { User, UserRole } from '../types';

export const useAuthStore = defineStore('auth', () => {
	const user = ref<User | null>(null);

	// Simulated initial state
	user.value = {
		id: '1',
		name: 'Admin Nexo',
		email: 'admin@nexo.ai',
		role: 'admin',
		image: 'A',
	};

	const isAuthenticated = computed(() => !!user.value);

	// Update CASL abilities whenever user changes
	watch(
		() => user.value,
		(newUser) => {
			ability.update([]); // Reset

			if (newUser?.role === 'admin') {
				// Admin can do everything
				ability.update([{ action: 'manage', subject: 'all' }]);
			} else if (newUser?.role === 'user') {
				// User can only see their own stuff
				ability.update([
					{ action: 'read', subject: 'UserContent' },
					{ action: 'manage', subject: 'PersonalData' },
					{ action: 'read', subject: 'Analytics' }, // Limited view
				]);
			}
		},
		{ immediate: true },
	);

	function login(profile: User) {
		user.value = profile;
	}

	function logout() {
		user.value = null;
	}

	function toggleRole() {
		if (user.value) {
			const newRole: UserRole = user.value.role === 'admin' ? 'user' : 'admin';
			user.value = {
				...user.value,
				role: newRole,
				name: newRole === 'admin' ? 'Admin Nexo' : 'José Usuário',
			};
		}
	}

	return {
		user,
		isAuthenticated,
		login,
		logout,
		toggleRole,
	};
});
