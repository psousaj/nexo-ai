<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { User, Mail, Link as LinkIcon, Smartphone, XCircle, Plus, MessageSquare, Loader2, RefreshCw } from 'lucide-vue-next';
import { useAuthStore } from '../store/auth';
import { dashboardService } from '../services/dashboard.service';
import { authClient } from '../lib/auth-client';
import { useRoute } from 'vue-router';

const authStore = useAuthStore();
const queryClient = useQueryClient();
const route = useRoute();

// Fetch Real Accounts
const { data: accountsData, isLoading: isLoadingAccounts } = useQuery({
	queryKey: ['user-accounts'],
	queryFn: () => dashboardService.getAccounts(),
});

// Sincronizar accounts automaticamente no mount e após redirect de OAuth
onMounted(async () => {
	// Se veio de um redirect de OAuth (success=discord ou success=google)
	const successProvider = route.query.success;
	
	if (successProvider) {
		console.log(`✅ [Profile] OAuth concluído para ${successProvider}, sincronizando...`);
		// Aguardar 1s para garantir que o Better Auth finalizou tudo
		setTimeout(async () => {
			await syncAccounts();
		}, 1000);
	}
});

const connectedAccounts = computed(() => {
	const accounts = accountsData.value || [];
	return [
		{
			id: 'whatsapp',
			name: 'WhatsApp',
			icon: Smartphone,
			status: accounts.find((a) => a.provider === 'whatsapp') ? 'connected' : 'disconnected',
			username: accounts.find((a) => a.provider === 'whatsapp')?.metadata?.phone || null,
		},
		{
			id: 'telegram',
			name: 'Telegram',
			icon: MessageSquare,
			status: accounts.find((a) => a.provider === 'telegram') ? 'connected' : 'disconnected',
			username: accounts.find((a) => a.provider === 'telegram')?.metadata?.username || null,
		},
		{
			id: 'discord',
			name: 'Discord',
			icon: MessageSquare,
			status: accounts.find((a) => a.provider === 'discord') ? 'connected' : 'disconnected',
			username: accounts.find((a) => a.provider === 'discord')?.metadata?.username || null,
		},
		{
			id: 'google',
			name: 'Google',
			icon: Mail,
			status: accounts.find((a) => a.provider === 'google') ? 'connected' : 'disconnected',
			username: accounts.find((a) => a.provider === 'google')?.metadata?.email || null,
		},
	];
});

const isEditing = ref(false);
const profileForm = ref({
	name: authStore.user?.name || '',
	email: authStore.user?.email || '',
});

const handleSave = () => {
	if (authStore.user) {
		authStore.user.name = profileForm.value.name;
		authStore.user.email = profileForm.value.email;
	}
	isEditing.value = false;
};

// Linking Logic
const isLinking = ref(false);
const isSyncing = ref(false);
const linkingToken = ref('');
const showTokenInput = ref<string | null>(null);

const syncAccounts = async () => {
	isSyncing.value = true;
	try {
		const result = await dashboardService.syncAccounts();
		console.log('✅ [Profile] Sincronização concluída:', result);
		// Atualizar lista de accounts
		await queryClient.invalidateQueries({ queryKey: ['user-accounts'] });
		return result;
	} catch (error) {
		console.error('❌ [Profile] Erro ao sincronizar:', error);
	} finally {
		isSyncing.value = false;
	}
};

const handleLink = async (provider: string) => {
	isLinking.value = true;
	try {
		if (provider === 'telegram') {
			const { link } = await dashboardService.linkTelegram();
			window.open(link, '_blank');
		} else if (provider === 'discord') {
			// Usar Better Auth client-side para Discord OAuth
			await authClient.signIn.social({
				provider: 'discord',
				callbackURL: `${window.location.origin}/profile?success=discord`,
			});
		} else if (provider === 'google') {
			// Usar Better Auth client-side para Google OAuth
			await authClient.signIn.social({
				provider: 'google',
				callbackURL: `${window.location.origin}/profile?success=google`,
			});
		}
	} catch (error) {
		console.error(`Failed to link ${provider}:`, error);
	} finally {
		setTimeout(() => {
			isLinking.value = false;
		}, 2000);
	}
};

const handleManualLink = async () => {
	if (!linkingToken.value) return;
	isLinking.value = true;
	try {
		await dashboardService.consumeLinkingToken(linkingToken.value);
		await queryClient.invalidateQueries({ queryKey: ['user-accounts'] });
		showTokenInput.value = null;
		linkingToken.value = '';
	} catch (error) {
		alert('Código inválido ou expirado');
	} finally {
		isLinking.value = false;
	}
};

const handleUnlink = async (provider: string) => {
	if (!confirm(`Tem certeza que deseja desvincular a conta do ${provider}?`)) return;

	isSyncing.value = true;
	try {
		await dashboardService.unlinkAccount(provider);
		await queryClient.invalidateQueries({ queryKey: ['user-accounts'] });
		console.log(`✅ [Profile] Conta ${provider} desvinculada`);
	} catch (error) {
		console.error(`❌ [Profile] Erro ao desvincular ${provider}:`, error);
		alert('Erro ao desvincular conta');
	} finally {
		isSyncing.value = false;
	}
};
</script>

<template>
	<div class="max-w-4xl mx-auto space-y-8 animate-fade-in">
		<!-- Profile Header -->
		<div class="premium-card overflow-hidden">
			<div class="h-32 bg-gradient-to-r from-primary-600 to-blue-600 relative">
				<div class="absolute -bottom-12 left-8">
					<div class="w-24 h-24 rounded-2xl bg-white dark:bg-surface-800 p-1 shadow-2xl">
						<div
							class="w-full h-full rounded-xl bg-gradient-to-tr from-primary-500 to-blue-400 flex items-center justify-center text-white text-3xl font-black italic"
						>
							{{ authStore.user?.name?.charAt(0) }}
						</div>
					</div>
				</div>
			</div>

			<div class="pt-16 pb-8 px-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
				<div>
					<h2 class="text-3xl font-bold text-surface-900 dark:text-white">{{ authStore.user?.name }}</h2>
					<p class="text-surface-500 dark:text-surface-400 flex items-center gap-2"><Mail class="w-4 h-4" /> {{ authStore.user?.email }}</p>
				</div>

				<div class="flex items-center gap-3">
					<button
						@click="isEditing = !isEditing"
						class="px-5 py-2.5 bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-white rounded-xl font-bold text-sm hover:bg-surface-200 transition-all border border-surface-200 dark:border-surface-700"
					>
						{{ isEditing ? 'Cancelar' : 'Editar Perfil' }}
					</button>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
			<!-- Edit Info -->
			<div v-if="isEditing" class="premium-card space-y-6">
				<h3 class="text-xl font-bold flex items-center gap-2">
					<User class="w-5 h-5 text-primary-600" />
					Dados Pessoais
				</h3>

				<div class="space-y-4">
					<div>
						<label class="block text-sm font-bold text-surface-500 mb-1.5 uppercase tracking-wider">Nome</label>
						<input
							v-model="profileForm.name"
							type="text"
							class="w-full px-4 py-3 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all outline-none"
						/>
					</div>
					<div>
						<label class="block text-sm font-bold text-surface-500 mb-1.5 uppercase tracking-wider">E-mail</label>
						<input
							v-model="profileForm.email"
							type="email"
							class="w-full px-4 py-3 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all outline-none"
						/>
					</div>
					<button
						@click="handleSave"
						class="w-full py-3 bg-primary-600 text-white rounded-xl font-black shadow-lg shadow-primary-600/30 hover:bg-primary-700 hover:scale-[1.02] transition-all"
					>
						Salvar Alterações
					</button>
				</div>
			</div>

			<!-- Connected Accounts -->
			<div class="premium-card space-y-6" :class="{ 'lg:col-span-2': !isEditing }">
				<div class="flex items-center justify-between">
					<h3 class="text-xl font-bold flex items-center gap-2">
						<LinkIcon class="w-5 h-5 text-primary-600" />
						Contas Vinculadas
					</h3>
					<button
						@click="syncAccounts"
						:disabled="isSyncing"
						class="px-3 py-2 bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-white rounded-lg font-medium text-sm hover:bg-surface-200 transition-all border border-surface-200 dark:border-surface-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
						title="Sincronizar contas vinculadas"
					>
						<RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isSyncing }" />
						{{ isSyncing ? 'Sincronizando...' : 'Sincronizar' }}
					</button>
				</div>

				<div v-if="isLoadingAccounts" class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
					<div v-for="i in 3" :key="i" class="h-20 bg-surface-100 dark:bg-surface-800 rounded-2xl"></div>
				</div>

				<div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div
						v-for="account in connectedAccounts"
						:key="account.id"
						class="p-4 rounded-2xl border flex items-center justify-between group transition-all"
						:class="
							account.status === 'connected'
								? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/50 shadow-sm'
								: 'bg-surface-50 dark:bg-surface-900/50 border-surface-200 dark:border-surface-800'
						"
					>
						<div class="flex items-center gap-4">
							<div
								:class="[
									'w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110',
									account.status === 'connected'
										? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
										: 'bg-surface-100 dark:bg-surface-800 text-surface-400',
								]"
							>
								<component :is="account.icon" class="w-6 h-6" />
							</div>
							<div>
								<div class="flex items-center gap-2">
									<p class="font-bold text-surface-900 dark:text-white">{{ account.name }}</p>
									<span
										v-if="account.status === 'connected'"
										class="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-tighter rounded"
										>Ativo</span
									>
								</div>
								<p class="text-sm text-surface-500 font-medium">{{ account.username || 'Não vinculado' }}</p>
								<!-- Link para adicionar bot Discord -->
								<a
									v-if="account.id === 'discord' && account.status === 'connected'"
									href="https://discord.com/oauth2/authorize?client_id=1465015304244559892"
									target="_blank"
									class="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 mt-1"
								>
									<Plus class="w-3 h-3" />
									Adicionar bot no servidor
								</a>
							</div>
						</div>

						<div v-if="account.id !== 'whatsapp'">
							<button
								v-if="account.status === 'connected'"
								@click="handleUnlink(account.id)"
								class="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
								title="Desvincular"
								:disabled="isSyncing"
							>
								<XCircle class="w-5 h-5" />
							</button>
							<button
								v-else
								@click="handleLink(account.id)"
								:disabled="isLinking"
								class="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50"
							>
								<Loader2 v-if="isLinking" class="w-5 h-5 animate-spin" />
								<Plus v-else class="w-5 h-5" />
							</button>
						</div>
					</div>
				</div>

				<!-- Manual Token Linking -->
				<div class="pt-4 border-t border-surface-200 dark:border-surface-800">
					<div v-if="showTokenInput" class="space-y-4 animate-fade-in">
						<label class="block text-xs font-black uppercase tracking-widest text-surface-500">Já tem um código de vínculo?</label>
						<div class="flex gap-2">
							<input
								v-model="linkingToken"
								placeholder="Ex: AB12CD"
								maxlength="14"
								class="flex-1 px-4 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all outline-none font-mono tracking-widest uppercase"
							/>
							<button
								@click="handleManualLink"
								:disabled="isLinking || !linkingToken"
								class="px-6 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 transition-all flex items-center gap-2"
							>
								<Loader2 v-if="isLinking" class="w-4 h-4 animate-spin" />
								Vincular
							</button>
							<button
								@click="showTokenInput = null"
								class="p-2 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-all"
							>
								<XCircle class="w-5 h-5" />
							</button>
						</div>
					</div>
					<button
						v-else
						@click="showTokenInput = 'any'"
						class="text-sm font-bold text-primary-600 hover:text-primary-700 flex items-center gap-2 px-1"
					>
						<Plus class="w-4 h-4" />
						Tenho um código de vinculação
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.animate-fade-in {
	animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(20px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
</style>
