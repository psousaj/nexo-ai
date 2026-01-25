import { defineStore } from 'pinia';
import { computed, watch, ref } from 'vue';
import { ability } from '../plugins/casl';
import { authClient, useSession } from '../lib/auth-client';
import type { User } from '../types';

export const useAuthStore = defineStore('auth', () => {
	const sessionInfo = useSession();
	const manualSession = ref<any>(null);

	const user = computed(() => {
		// Usa manualSession como fallback quando useSession ainda não atualizou
		const data = sessionInfo.value?.data || manualSession.value;
		if (!data?.user) {
			console.log('👤 Auth Store: Sem dados de sessão', { sessionInfo: sessionInfo.value, manualSession: manualSession.value });
			return null;
		}
		const u = data.user as any;
		console.log('👤 Auth Store: Usuário carregado:', { email: u.email, role: u.role });
		return {
			id: u.id,
			name: u.name,
			email: u.email,
			image: u.image || '',
			role: u.role || 'user',
			permissions: u.permissions || [],
		};
	});

	const isAuthenticated = computed(() => {
		const data = sessionInfo.value?.data || manualSession.value;
		const auth = !!data?.user;
		console.log('🔐 Auth Store: isAuthenticated =', auth, { hasData: !!data, hasUser: !!data?.user });
		return auth;
	});
	const isLoadingSession = computed(() => {
		const loading = sessionInfo.value?.isPending ?? true;
		console.log('⏳ Auth Store: isLoadingSession =', loading);
		return loading;
	});

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
		manualSession.value = null;
		await authClient.signOut();
	}

	async function refetchSession() {
		try {
			console.log('🔄 Auth Store: Buscando sessão manualmente...');
			// Usa $fetch que faz a requisição correta com credentials
			const response = await authClient.$fetch<{ session: any; user: any }>('/get-session', {
				method: 'GET',
			});
			console.log('🔄 Auth Store: Resposta da sessão:', response);
			if (response.data?.user) {
				manualSession.value = { user: response.data.user, session: response.data.session };
				console.log('✅ Auth Store: Sessão manual atualizada:', manualSession.value);
			}
			return response;
		} catch (error) {
			console.error('❌ Auth Store: Erro ao buscar sessão:', error);
			return null;
		}
	}

	function setSessionFromLogin(loginResponse: any) {
		if (loginResponse?.user) {
			manualSession.value = { user: loginResponse.user, session: loginResponse.session };
			console.log('✅ Auth Store: Sessão definida do login:', manualSession.value);
		}
	}

	return {
		user,
		isAuthenticated,
		isLoadingSession,
		logout,
		refetchSession,
		setSessionFromLogin,
	};
});
