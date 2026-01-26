import { defineStore } from 'pinia';
import { computed, watch, ref } from 'vue';
import { ability } from '../plugins/casl';
import { authClient, useSession } from '../lib/auth-client';
import type { User } from '../types';

export const useAuthStore = defineStore('auth', () => {
	const sessionInfo = useSession();
	const manualSession = ref<any>(null);

	const simulatedRole = ref<string | null>(null);

	// Inicializa a role simulada com a role real do usuário ao carregar a sessão
	watch(
		() => sessionInfo.value?.data || manualSession.value,
		(data) => {
			if (data?.user && simulatedRole.value === null) {
				simulatedRole.value = data.user.role;
			}
		},
		{ immediate: true }
	);

	const user = computed(() => {
		// Usa manualSession como fallback quando useSession ainda não atualizou
		const data = sessionInfo.value?.data || manualSession.value;
		if (!data?.user) {
			console.log('👤 Auth Store: Sem dados de sessão', { sessionInfo: sessionInfo.value, manualSession: manualSession.value });
			return null;
		}
		const u = data.user as any;
		console.log('👤 Auth Store: Usuário carregado:', { email: u.email, role: u.role, raw: u });
		return {
			id: u.id,
			name: u.name,
			email: u.email,
			image: u.image || '',
			role: simulatedRole.value || u.role || 'user',
			permissions: u.permissions || [],
		};
	});
// Simulação de troca de role (apenas frontend)
function toggleRole() {
	if (!user.value) return;
	if (simulatedRole.value === 'admin') {
		simulatedRole.value = 'user';
	} else {
		simulatedRole.value = 'admin';
	}
	console.log('🔄 Simulação de role:', simulatedRole.value);
}

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
			console.log('🔐 CASL: Atualizando abilities para usuário:', newUser);
			
			if (!newUser) {
				// Sem usuário, sem permissões
				ability.update([]);
				console.log('🔐 CASL: Nenhum usuário, abilities resetadas');
				return;
			}

			// Se tem permissions customizadas no banco, usa elas
			if (newUser.permissions && Array.isArray(newUser.permissions) && newUser.permissions.length > 0) {
				ability.update(newUser.permissions);
				console.log('🔐 CASL: Usando permissions do banco:', newUser.permissions);
				return;
			}

			// Fallback baseado na role
			if (newUser.role === 'admin') {
				ability.update([
					{ action: 'manage', subject: 'all' }, // Admin pode tudo
				]);
				console.log('🔐 CASL: Admin - acesso total');
			} else {
				ability.update([
					{ action: 'read', subject: 'UserContent' },
					{ action: 'manage', subject: 'PersonalData' },
					{ action: 'read', subject: 'Analytics' },
				]);
				console.log('🔐 CASL: User - acesso básico');
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
		toggleRole,
	};
});
