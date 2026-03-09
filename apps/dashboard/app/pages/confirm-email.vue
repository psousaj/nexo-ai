<script setup lang="ts">
definePageMeta({
	layout: false,
});

const authStore = useAuthStore();
const authClient = useAuthClient();

const isSending = ref(false);
const resendMessage = ref('');
const resendError = ref('');

const isAlreadyVerified = computed(() => !!authStore.user?.emailVerified);

const resendConfirmation = async () => {
	if (!authStore.isAuthenticated) {
		resendError.value = 'Faça login para reenviar o email de confirmação.';
		return;
	}

	if (isAlreadyVerified.value) {
		resendMessage.value = 'Seu email já está confirmado.';
		return;
	}

	isSending.value = true;
	resendMessage.value = '';
	resendError.value = '';

	try {
		await authClient.sendVerificationEmail({
			email: authStore.user!.email,
			callbackURL: '/',
		});
		resendMessage.value = `Email de confirmação enviado para ${authStore.user!.email}.`;
	} catch (error: any) {
		resendError.value = error?.message || 'Não foi possível reenviar o email agora.';
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
	if (authStore.isAuthenticated) {
		await authStore.refreshProfile();
		if (authStore.user?.emailVerified) {
			await navigateTo('/', { replace: true });
			return;
		}
	} else {
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
					<span v-if="isAlreadyVerified">Seu email foi confirmado com sucesso.</span>
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
					v-if="isAlreadyVerified"
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

					<button
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
