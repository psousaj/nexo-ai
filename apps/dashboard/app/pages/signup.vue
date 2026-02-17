<script setup lang="ts">
import { LayoutGrid, Mail, Lock, Loader2 } from 'lucide-vue-next';

definePageMeta({
	layout: false,
});

const authClient = useAuthClient();

const name = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const isLoading = ref(false);
const error = ref('');

const handleSignup = async () => {
	// Validações básicas
	if (password.value !== confirmPassword.value) {
		error.value = 'As senhas não coincidem';
		return;
	}

	if (password.value.length < 8) {
		error.value = 'A senha deve ter pelo menos 8 caracteres';
		return;
	}

	isLoading.value = true;
	error.value = '';

	try {
		const { data, error: authError } = await authClient.signUp.email({
			email: email.value,
			password: password.value,
			name: name.value,
		});

		if (authError) {
			error.value = authError.message || 'Erro ao criar conta';
		} else {
			// Redirecionar para o dashboard após criar conta
			router.push('/');
		}
	} catch (e) {
		console.error('Signup error:', e);
		error.value = 'Ocorreu um erro inesperado';
	} finally {
		isLoading.value = false;
	}
};

const loginWithSocial = async (provider: 'google' | 'discord') => {
	await authClient.signIn.social({
		provider,
		callbackURL: process.client ? `${window.location.origin}/` : '/',
	});
};
</script>

<template>
	<div class="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center p-6">
		<div class="w-full max-w-md space-y-8">
			<!-- Logo -->
			<div class="flex flex-col items-center">
				<div class="w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-primary-500/20">
					<LayoutGrid class="w-8 h-8" />
				</div>
				<h1 class="text-2xl font-bold text-surface-900 dark:text-white">NEXO AI</h1>
				<p class="text-surface-500 font-medium">Sua segunda memória inteligente</p>
			</div>

			<div class="premium-card p-8! space-y-6">
				<div class="space-y-2">
					<h2 class="text-2xl font-bold text-surface-900 dark:text-white">Crie sua conta</h2>
					<p class="text-surface-500">Comece a organizar suas memórias agora.</p>
				</div>

				<div
					v-if="error"
					class="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-sm font-medium"
				>
					{{ error }}
				</div>

				<form class="space-y-4" @submit.prevent="handleSignup">
					<div class="space-y-1.5">
						<label class="text-xs font-black uppercase tracking-widest text-surface-500 ml-1">Nome completo</label>
						<div class="relative">
							<User class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
							<input
								v-model="name"
								type="text"
								placeholder="Seu nome"
								class="w-full pl-12 pr-4 py-3 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all outline-none"
								required
							/>
						</div>
					</div>

					<div class="space-y-1.5">
						<label class="text-xs font-black uppercase tracking-widest text-surface-500 ml-1">Email</label>
						<div class="relative">
							<Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
							<input
								v-model="email"
								type="email"
								placeholder="exemplo@email.com"
								class="w-full pl-12 pr-4 py-3 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all outline-none"
								required
							/>
						</div>
					</div>

					<div class="space-y-1.5">
						<label class="text-xs font-black uppercase tracking-widest text-surface-500 ml-1">Senha</label>
						<div class="relative">
							<Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
							<input
								v-model="password"
								type="password"
								placeholder="••••••••"
								class="w-full pl-12 pr-4 py-3 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all outline-none"
								required
								minlength="8"
							/>
						</div>
					</div>

					<div class="space-y-1.5">
						<label class="text-xs font-black uppercase tracking-widest text-surface-500 ml-1">Confirmar senha</label>
						<div class="relative">
							<Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
							<input
								v-model="confirmPassword"
								type="password"
								placeholder="••••••••"
								class="w-full pl-12 pr-4 py-3 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all outline-none"
								required
								minlength="8"
							/>
						</div>
					</div>

					<button
						type="submit"
						:disabled="isLoading"
						class="w-full py-3.5 bg-primary-600 text-white rounded-xl font-black shadow-lg shadow-primary-600/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
					>
						<Loader2 v-if="isLoading" class="w-5 h-5 animate-spin" />
						{{ isLoading ? 'Criando conta...' : 'Criar Conta' }}
					</button>
				</form>

				<div class="relative py-4">
					<div class="absolute inset-0 flex items-center">
						<div class="w-full border-t border-surface-200 dark:border-surface-800" />
					</div>
					<div class="relative flex justify-center text-sm">
						<span class="px-3 bg-white dark:bg-surface-900 text-surface-500 font-bold">OU</span>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<button
						class="flex items-center justify-center gap-2 py-3 border border-surface-200 dark:border-surface-800 rounded-xl font-bold hover:bg-surface-50 dark:hover:bg-surface-800 transition-all"
						@click="loginWithSocial('google')"
					>
						<span>Google</span>
					</button>
					<button
						class="flex items-center justify-center gap-2 py-3 border border-surface-200 dark:border-surface-800 rounded-xl font-bold hover:bg-surface-50 dark:hover:bg-surface-800 transition-all"
						@click="loginWithSocial('discord')"
					>
						<span>Discord</span>
					</button>
				</div>

				<div class="text-center">
					<NuxtLink to="/login" class="text-sm font-bold text-primary-600 hover:text-primary-700"> Já tem uma conta? Faça login </NuxtLink>
				</div>
			</div>
		</div>
	</div>
</template>
