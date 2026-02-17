<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Link as LinkIcon, Loader2, Mail, MessageSquare, Plus, RefreshCw, Smartphone, User, XCircle } from 'lucide-vue-next';
import { useDashboard } from '~/composables/useDashboard';
import { useAuthStore } from '~/stores/auth';

const authClient = useAuthClient();
const authStore = useAuthStore();
const dashboard = useDashboard();
const queryClient = useQueryClient();
const route = useRoute();

// Fetch Real Accounts
const { data: accountsData, isLoading: isLoadingAccounts } = useQuery({
queryKey: ['user-accounts'],
queryFn: () => dashboard.getAccounts(),
});

// Fetch Discord Bot Info
const { data: discordBotInfo } = useQuery({
queryKey: ['discord-bot-info'],
queryFn: () => dashboard.getDiscordBotInfo(),
});

// Sincronizar accounts automaticamente no mount e após redirect de OAuth
onMounted(async () => {
	const successProvider = route.query.success;
	if (successProvider) {
		console.log(`✅ [Profile] OAuth concluído para ${successProvider}, sincronizando...`);
		setTimeout(async () => { await syncAccounts(); }, 1000);
	}
});

const connectedAccounts = computed(() => {
	const accounts = (accountsData.value as any[]) || [];
	return [
		{ id: 'whatsapp', name: 'WhatsApp', icon: Smartphone, status: accounts.find((a) => a.provider === 'whatsapp') ? 'connected' : 'disconnected', username: accounts.find((a) => a.provider === 'whatsapp')?.metadata?.phone || null },
		{ id: 'telegram', name: 'Telegram', icon: MessageSquare, status: accounts.find((a) => a.provider === 'telegram') ? 'connected' : 'disconnected', username: accounts.find((a) => a.provider === 'telegram')?.metadata?.username || null },
		{ id: 'discord', name: 'Discord', icon: MessageSquare, status: accounts.find((a) => a.provider === 'discord') ? 'connected' : 'disconnected', username: accounts.find((a) => a.provider === 'discord')?.metadata?.username || null },
		{ id: 'google', name: 'Google', icon: Mail, status: accounts.find((a) => a.provider === 'google') ? 'connected' : 'disconnected', username: accounts.find((a) => a.provider === 'google')?.metadata?.email || null },
	];
});

const isEditing = ref(false);
const profileForm = ref({ name: authStore.user?.name || '', email: authStore.user?.email || '' });
const handleSave = () => { isEditing.value = false; };

// Linking Logic
const isLinking = ref(false);
const isSyncing = ref(false);
const linkingToken = ref('');
const showTokenInput = ref<string | null>(null);

const syncAccounts = async () => {
	isSyncing.value = true;
	try {
		const result = await dashboard.syncAccounts();
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
			const { link } = await dashboard.linkTelegram();
			if (process.client) window.open(link, '_blank');
		} else if (provider === 'discord') {
			const { link } = await dashboard.linkDiscord();
			if (process.client) window.open(link, '_blank');
		} else if (provider === 'google') {
			await authClient.signIn.social({ provider: 'google', callbackURL: process.client ? `${window.location.origin}/profile?success=google` : '/profile?success=google' });
		}
	} catch (error) {
		console.error(`Failed to link ${provider}:`, error);
	} finally {
		setTimeout(() => { isLinking.value = false; }, 2000);
	}
};

const handleManualLink = async () => {
	if (!linkingToken.value) return;
	isLinking.value = true;
	try {
		await dashboard.consumeLinkingToken(linkingToken.value);
		await queryClient.invalidateQueries({ queryKey: ['user-accounts'] });
		showTokenInput.value = null;
		linkingToken.value = '';
	} catch (_error) {
		if (process.client) alert('Código inválido ou expirado');
	} finally {
		isLinking.value = false;
	}
};

const handleUnlink = async (provider: string) => {
	if (process.client && !confirm(`Tem certeza que deseja desvincular a conta do ${provider}?`)) return;
	isSyncing.value = true;
	try {
		await dashboard.unlinkAccount(provider);
		await queryClient.invalidateQueries({ queryKey: ['user-accounts'] });
	} catch (error) {
		console.error(`❌ [Profile] Erro ao desvincular ${provider}:`, error);
		if (process.client) alert('Erro ao desvincular conta');
	} finally {
		isSyncing.value = false;
	}
};
</script>

<template>
	<div class="max-w-4xl mx-auto space-y-8 animate-fade-in">
		<div class="premium-card overflow-hidden">
			<div class="h-32 bg-gradient-to-r from-primary-600 to-blue-600 relative">
				<div class="absolute -bottom-12 left-8">
					<div class="w-24 h-24 rounded-2xl bg-white dark:bg-surface-800 p-1 shadow-2xl">
						<div class="w-full h-full rounded-xl bg-gradient-to-tr from-primary-500 to-blue-400 flex items-center justify-center text-white text-3xl font-black italic">
							{{ authStore.user?.name?.charAt(0) }}
						</div>
					</div>
				</div>
			</div>
			<div class="pt-16 pb-8 px-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
				<div>
					<h2 class="text-3xl font-bold text-surface-900 dark:text-white">{{ authStore.user?.name }}</h2>
					<p class="text-surface-500 dark:text-surface-400 flex items-center gap-2">
						<Mail class="w-4 h-4" />
						{{ authStore.user?.email }}
					</p>
				</div>
				<div class="flex items-center gap-3">
					<button @click="isEditing = !isEditing" class="px-5 py-2.5 bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-white rounded-xl font-bold text-sm hover:bg-surface-200 transition-all border border-surface-200 dark:border-surface-700">
						{{ isEditing ? 'Cancelar' : 'Editar Perfil' }}
					</button>
				</div>
			</div>
		</div>
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
			<div v-if="isEditing" class="premium-card space-y-6">
				<h3 class="text-xl font-bold flex items-center gap-2">
					<User class="w-5 h-5 text-primary-600" />
					Dados Pessoais
				</h3>
				<div class="space-y-4">
					<div>
						<label class="block text-sm font-bold text-surface-500 mb-1.5 uppercase tracking-wider">Nome</label>
						<input v-model="profileForm.name" type="text" class="w-full px-4 py-3 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all outline-none" />
					</div>
					<div>
						<label class="block text-sm font-bold text-surface-500 mb-1.5 uppercase tracking-wider">E-mail</label>
						<input v-model="profileForm.email" type="email" class="w-full px-4 py-3 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all outline-none" />
					</div>
					<button @click="handleSave" class="w-full py-3 bg-primary-600 text-white rounded-xl font-black shadow-lg shadow-primary-600/30 hover:bg-primary-700 hover:scale-[1.02] transition-all">
						Salvar Alterações
					</button>
				</div>
			</div>
			<div class="premium-card space-y-6" :class="{ 'lg:col-span-2': !isEditing }">
				<div class="flex items-center justify-between">
					<h3 class="text-xl font-bold flex items-center gap-2">
						<LinkIcon class="w-5 h-5 text-primary-600" />
						Contas Vinculadas
					</h3>
					<button @click="syncAccounts" :disabled="isSyncing" class="px-3 py-2 bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-white rounded-lg font-medium text-sm hover:bg-surface-200 transition-all border border-surface-200 dark:border-surface-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
						<RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isSyncing }" />
						{{ isSyncing ? 'Sincronizando...' : 'Sincronizar' }}
					</button>
				</div>
				<div v-if="isLoadingAccounts" class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
					<div v-for="i in 3" :key="i" class="h-20 bg-surface-100 dark:bg-surface-800 rounded-2xl"></div>
				</div>
				<div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div v-for="account in connectedAccounts" :key="account.id" class="p-4 rounded-2xl border flex items-center justify-between group transition-all" :class="account.status === 'connected' ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/50 shadow-sm' : 'bg-surface-50 dark:bg-surface-900/50 border-surface-200 dark:border-surface-800'">
						<div class="flex items-center gap-4">
							<div :class="['w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110', account.status === 'connected' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-surface-100 dark:bg-surface-800 text-surface-400']">
								<component :is="account.icon" class="w-6 h-6" />
							</div>
							<div>
								<div class="flex items-center gap-2">
									<p class="font-bold text-surface-900 dark:text-white">{{ account.name }}</p>
									<span v-if="account.status === 'connected'" class="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-tighter rounded">Ativo</span>
								</div>
								<p class="text-sm text-surface-500 font-medium">{{ account.username || 'Não vinculado' }}</p>
								<!-- Link para adicionar bot Discord -->
								<a
									v-if="account.id === 'discord' && account.status === 'connected' && discordBotInfo?.installUrl"
									:href="discordBotInfo.installUrl"
									target="_blank"
									class="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg transition-all"
								>
									<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
										<path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.75.75 0 00-.18.07c-.29.12-.55.3-.78.53-.47-.2-.97-.3-1.48-.28-.74.05-1.47.18-2.15.36a.75.75 0 00-.57.06c-.36.06-.69.2-.97.43-.63.43-1.14.95-1.51 1.47-.52.74-.89 1.41-1.09 2.12-.18.65-.27-1.33-.27-2.03 0-1.42.67-2.68 1.74-3.75C7.72 5.55 9.15 5 10.65 5c.25 0 .5.05.74.15.45.26.86.64 1.32.97 1.88.76.45.15.92-.08 1.4-.26.48-.2 1-.36 1.55-.54.55-.18 1.12-.26 1.7-.27.68 0 1.36.27 1.95.82.57.52.89 1.1 1.46 1.53-.38.27-.76.42-1.17.27-.5-.18-.85-.05-1.31.18-.46.23-.69.68-.98.87-.28.2-.61.47-1.15.6-1.74.12-.58.3-.98.38-1.55.32-.57-.06-1.15-.19-1.76-.13-.61.06-1.24.13-1.87.2-.63.07-1.27-.19-1.89-.2-.62 0-1.24.13-1.86.21-.62.08-1.25.2-1.87.35-.62.15-1.24.35-1.83.6-.59.25-1.18.41-1.75.54-.57.13-1.15.36-1.7.68-.55.32-1.1.76-1.62.94-.52.18-1.05.28-1.6.38-.55.1-1.12.23-1.67.43-.55.2-1.1.48-1.62.77-.52.29-1.05.63-1.55 1.03-.5.4-1 .84-1.47 1.32-.47.48-.85.81-1.31.97-.46.16-.9.38-1.38.5-.48.12-.96-.27-1.42-.39-.46-.12-.93-.19-1.39-.32-.46-.13-.93-.31-1.4-.49-.47-.18-.93-.37-1.4-.44-.46-.07-.92-.12-1.39-.24-.47-.12-.95-.35-1.41-.59-.46-.24-.92-.6-1.39-.58-.47.02-.94.21-1.41.59-.47.38-.89.92-1.23 1.58-.34.66-.63 1.02-1.29 1.2-1.92.18-.63.47-.98.36-1.38 1.01-.4.65-.67.58-1.31.52-1.94.33-.63.76-.22 1.39-.24 2.08-.02.69-.18 1.35-.52 1.99-.34.64-.64 1.23-1.08 1.91-1.31.68-.23 1.34-.47 2.68-.7 4.02z"/>
									</svg>
									Adicionar bot ao servidor
								</a>
								<!-- Aviso se bot não configurado -->
								<div v-if="account.id === 'discord' && account.status === 'connected' && !discordBotInfo?.botTokenConfigured" class="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
									<p class="text-xs text-amber-700 dark:text-amber-300">⚠️ Bot não configurado - Token ausente</p>
								</div>
							</div>
						</div>
						<div v-if="account.id !== 'whatsapp'">
							<button v-if="account.status === 'connected'" @click="handleUnlink(account.id)" class="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" :disabled="isSyncing">
								<XCircle class="w-5 h-5" />
							</button>
							<button v-else @click="handleLink(account.id)" :disabled="isLinking" class="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50">
								<Loader2 v-if="isLinking" class="w-5 h-5 animate-spin" />
								<Plus v-else class="w-5 h-5" />
							</button>
						</div>
					</div>
				</div>
				<div class="pt-4 border-t border-surface-200 dark:border-surface-800">
					<div v-if="showTokenInput" class="space-y-4 animate-fade-in">
						<label class="block text-xs font-black uppercase tracking-widest text-surface-500">Já tem um código de vínculo?</label>
						<div class="flex gap-2">
							<input v-model="linkingToken" placeholder="Ex: AB12CD" maxlength="14" class="flex-1 px-4 py-2 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all outline-none font-mono tracking-widest uppercase" />
							<button @click="handleManualLink" :disabled="isLinking || !linkingToken" class="px-6 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 transition-all flex items-center gap-2">
								<Loader2 v-if="isLinking" class="w-4 h-4 animate-spin" />
								Vincular
							</button>
							<button @click="showTokenInput = null" class="p-2 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-all">
								<XCircle class="w-5 h-5" />
							</button>
						</div>
					</div>
					<button v-else @click="showTokenInput = 'any'" class="text-sm font-bold text-primary-600 hover:text-primary-700 flex items-center gap-2 px-1">
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
	from { opacity: 0; transform: translateY(20px); }
	to { opacity: 1; transform: translateY(0); }
}
</style>
