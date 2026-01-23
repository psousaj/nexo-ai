<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { authClient } from '../lib/auth-client';
import { Mail, Lock, User, Loader2, LayoutGrid } from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();

const name = ref('');
const email = ref('');
const password = ref('');
const isLoading = ref(false);
const error = ref('');
const signupToken = ref((route.query.token as string) || '');

const handleSignup = async () => {
	isLoading.value = true;
	error.value = '';
	try {
		const { error: authError } = await authClient.signUp.email({
			email: email.value,
			password: password.value,
			name: name.value,
			// Better Auth permite passar metadados
			// mas vamos gerenciar o token via endpoint customizado ou via logic no server
		});

		if (authError) {
			error.value = authError.message || 'Erro ao criar conta';
		} else {
			// Se houver token, precisamos vincular!
			// No Better Auth, o próprio ato de signup já cria o user.
			// O backend interceptará e vinculará o account se o email bater ou via token
			router.push('/');
		}
	} catch (e) {
		error.value = 'Ocorreu um erro inesperado';
	} finally {
		isLoading.value = false;
	}
};
</script>

<template>
	<div class="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center p-6">
		<div class="w-full max-w-md space-y-8">
			<div class="flex flex-col items-center">
				<div
					class="w-16 h-16 bg-gradient-to-tr from-primary-600 to-emerald-500 rounded-2xl flex items-center justify-center text-white mb-4 shadow-xl shadow-emerald-500/20"
				>
					<LayoutGrid class="w-8 h-8" />
				</div>
				<h1 class="text-3xl font-black text-surface-900 dark:text-white italic tracking-tighter">NEXO AI</h1>
				<p class="text-surface-500 font-medium">Inicie sua jornada inteligente</p>
			</div>

			<div class="premium-card !p-8 space-y-6">
				<div class="space-y-2">
					<h2 class="text-2xl font-bold text-surface-900 dark:text-white">
						{{ signupToken ? 'Conclua seu cadastro' : 'Criar nova conta' }}
					</h2>
					<p class="text-surface-500">
						{{ signupToken ? 'Falta pouco para você desbloquear o acesso ilimitado!' : 'Junte-se a milhares de usuários organizados.' }}
					</p>
				</div>

				<div
					v-if="error"
					class="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-sm font-medium"
				>
					{{ error }}
				</div>

				<form @submit.prevent="handleSignup" class="space-y-4">
					<div class="space-y-1.5">
						<label class="text-xs font-black uppercase tracking-widest text-surface-500 ml-1">Nome Completo</label>
						<div class="relative">
							<User class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
							<input
								v-model="name"
								type="text"
								placeholder="Como quer ser chamado?"
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
								placeholder="Crie uma senha segura"
								class="w-full pl-12 pr-4 py-3 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all outline-none"
								required
							/>
						</div>
					</div>

					<button
						type="submit"
						:disabled="isLoading"
						class="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-black shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
					>
						<Loader2 v-if="isLoading" class="w-5 h-5 animate-spin" />
						{{ isLoading ? 'Criando conta...' : 'Começar a usar agora' }}
					</button>
				</form>

				<div class="text-center">
					<router-link to="/login" class="text-sm font-bold text-primary-600 hover:text-primary-700">
						Já tem uma conta? Faça login
					</router-link>
				</div>
			</div>
		</div>
	</div>
</template>
