<script setup lang="ts">
import api from '@/utils/api';

definePageMeta({
	layout: false,
});

const route = useRoute();
const config = useRuntimeConfig();
const authStore = useAuthStore();
const authClient = useAuthClient();

const isSending = ref(false);
const resendMessage = ref('');
const resendError = ref('');

const queryToken = computed(() => route.query.token ?? route.query.code);
const token = computed(() => {
	const raw = queryToken.value;
	return Array.isArray(raw) ? raw[0] : raw;
});

const queryStatus = computed(() => {
	const raw = route.query.email_confirm;
	const value = Array.isArray(raw) ? raw[0] : raw;
	if (value === 'success' || value === 'invalid' || value === 'not_found') {
		return value;
	}
	return null;
});

const isSuccess = computed(() => queryStatus.value === 'success');
const hasToken = computed(() => typeof token.value === 'string' && token.value.trim().length > 0);
const isAlreadyVerified = computed(() => !!authStore.user?.emailVerified);

const resendConfirmation = async () => {
	if (!authStore.isAuthenticated) {
		resendError.value = 'Faça login para reenviar o email de confirmação.';
		return;
	}

	if (isAlreadyVerified.value) {
		resendError.value = '';
		resendMessage.value = 'Seu email já está confirmado.';
		return;
	}

	isSending.value = true;
	resendMessage.value = '';
	resendError.value = '';

	try {
		const response = await api.post('/user/emails/resend-confirmation');
		if (response.data?.alreadyVerified) {
			await authStore.refreshProfile();
			resendMessage.value = 'Seu email já está confirmado.';
			return;
		}
		const sentTo = response.data?.sentTo || authStore.user?.email;
		resendMessage.value = sentTo ? `Email de confirmação enviado para ${sentTo}.` : 'Email de confirmação reenviado com sucesso.';
	} catch (error: any) {
		resendError.value = error?.response?.data?.error || 'Não foi possível reenviar o email agora.';
	} finally {
		isSending.value = false;
	}
};

const goToDashboard = async () => {
	try {
		await authClient.getSession();
		await authStore.refreshProfile();
	} catch (error) {
		console.warn('Não foi possível atualizar sessão após confirmação:', error);
	}

	await navigateTo('/', { replace: true });
};

const handleLogout = async () => {
	await authStore.logout();
};

onMounted(async () => {
	if (hasToken.value) {
		const confirmUrl = new URL(`${config.public.apiUrl}/emails/confirm`);
		confirmUrl.searchParams.set('token', token.value as string);
		window.location.assign(confirmUrl.toString());
		return;
	}

	if (isSuccess.value) {
		try {
			await authClient.getSession();
			await authStore.refreshProfile();
		} catch (error) {
			console.warn('Falha ao atualizar sessão:', error);
		}
	}

	if (authStore.isAuthenticated) {
		await authStore.refreshProfile();
		if (authStore.user?.emailVerified) {
			await navigateTo('/', { replace: true });
			return;
		}
	}

	if (!authStore.isAuthenticated && !queryStatus.value) {
		await navigateTo('/login', { replace: true });
	}
});
</script>

<template>
	<div class="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center p-6">
		<div class="w-full max-w-md premium-card p-8! space-y-6">
			<div class="text-center space-y-2">
				<h1 class="text-2xl font-bold text-surface-900 dark:text-white">Confirmação de email</h1>
				<p class="text-surface-500">
					<span v-if="isSuccess || isAlreadyVerified">Seu email foi confirmado com sucesso.</span>
					<span v-else-if="queryStatus === 'invalid'">O link de confirmação é inválido ou expirou.</span>
					<span v-else-if="queryStatus === 'not_found'">Não encontramos este email para confirmação.</span>
					<span v-else>
						Confirme seu email para continuar no dashboard.
						<span v-if="authStore.user?.email" class="block mt-1 font-semibold text-surface-700 dark:text-surface-300">
							{{ authStore.user.email }}
						</span>
					</span>
				</p>
			</div>

			<div
				v-if="resendMessage"
				class="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl text-sm font-medium"
			>
				{{ resendMessage }}
			</div>

			<div
				v-if="resendError"
				class="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 p-4 rounded-xl text-sm font-medium"
			>
				{{ resendError }}
			</div>

			<div class="space-y-3">
				<button
					v-if="isSuccess || isAlreadyVerified"
					type="button"
					class="w-full py-3.5 bg-primary-600 text-white rounded-xl font-black shadow-lg shadow-primary-600/30 hover:bg-primary-700 transition-all"
					@click="goToDashboard"
				>
					Ir para o dashboard
				</button>

				<template v-else>
					<button
						type="button"
						:disabled="isSending"
						class="w-full py-3.5 bg-primary-600 text-white rounded-xl font-black shadow-lg shadow-primary-600/30 hover:bg-primary-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
						@click="resendConfirmation"
					>
						{{ isSending ? 'Reenviando...' : 'Reenviar email de confirmação' }}
					</button>

					<NuxtLink
						v-if="!authStore.isAuthenticated"
						to="/login"
						class="w-full inline-flex items-center justify-center py-3 border border-surface-200 dark:border-surface-800 rounded-xl font-bold hover:bg-surface-50 dark:hover:bg-surface-800 transition-all"
					>
						Fazer login
					</NuxtLink>

					<button
						v-else
						type="button"
						class="w-full inline-flex items-center justify-center py-3 border border-surface-200 dark:border-surface-800 rounded-xl font-bold hover:bg-surface-50 dark:hover:bg-surface-800 transition-all"
						@click="handleLogout"
					>
						Sair
					</button>
				</template>
			</div>
		</div>
	</div>
</template>
