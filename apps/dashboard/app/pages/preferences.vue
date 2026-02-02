<script setup lang="ts">
import { Bell, Eye, Moon, Sun, Lock, Smartphone, Loader2, CheckCircle2, Save } from 'lucide-vue-next';
import { usePreferencesStore } from '~/stores/preferences';

const preferencesStore = usePreferencesStore();
const activeTab = ref<'notifications' | 'security' | 'privacy'>('notifications');
const isSaving = ref(false);
const showSuccess = ref(false);

onMounted(() => {
	preferencesStore.fetchPreferences();
});

const handleSave = async () => {
	isSaving.value = true;
	try {
		await preferencesStore.updatePreferences({ ...preferencesStore.preferences });
		showSuccess.value = true;
		setTimeout(() => (showSuccess.value = false), 3000);
	} catch (error) {
		console.error('Failed to save preferences:', error);
	} finally {
		isSaving.value = false;
	}
};

const tabs = [
	{ id: 'notifications', label: 'Notificações', icon: Bell },
	{ id: 'security', label: 'Segurança', icon: Lock },
	{ id: 'privacy', label: 'Privacidade', icon: Eye },
];
</script>

<template>
	<div class="max-w-4xl mx-auto space-y-8 animate-fade-in">
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
			<div class="flex flex-col gap-2">
				<h2 class="text-2xl font-bold text-surface-900 dark:text-white">Preferências</h2>
				<p class="text-surface-500 dark:text-surface-400">Personalize como o Nexo AI interage com você.</p>
			</div>

			<div class="flex items-center gap-3">
				<Transition name="fade">
					<div
						v-if="showSuccess"
						class="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-bold border border-emerald-200 dark:border-emerald-800"
					>
						<CheckCircle2 class="w-4 h-4" /> Salvo com sucesso!
					</div>
				</Transition>
				<button
					@click="handleSave"
					:disabled="isSaving || preferencesStore.isLoading"
					class="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-black shadow-lg shadow-primary-600/20 hover:bg-primary-700 disabled:opacity-50 transition-all"
				>
					<Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
					<Save v-else class="w-4 h-4" />
					Salvar Alterações
				</button>
			</div>
		</div>

		<div v-if="preferencesStore.isLoading" class="grid grid-cols-1 md:grid-cols-3 gap-8 animate-pulse">
			<div class="h-40 bg-surface-100 dark:bg-surface-800 rounded-2xl"></div>
			<div class="md:col-span-2 h-96 bg-surface-100 dark:bg-surface-800 rounded-2xl"></div>
		</div>

		<div v-else class="grid grid-cols-1 md:grid-cols-3 gap-8">
			<!-- Sidebar Nav -->
			<div class="space-y-2">
				<button
					v-for="tab in tabs"
					:key="tab.id"
					@click="activeTab = tab.id as any"
					:class="[
						'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold border',
						activeTab === tab.id
							? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20 border-primary-500'
							: 'text-surface-600 dark:text-surface-400 hover:bg-white dark:hover:bg-surface-900 border-transparent hover:border-surface-200 dark:hover:border-surface-800',
					]"
				>
					<component :is="tab.icon" class="w-5 h-5" /> {{ tab.label }}
				</button>

				<div class="pt-6">
					<p class="text-[10px] font-black text-surface-400 uppercase tracking-widest px-4 mb-3">Sessão</p>
					<button
						class="w-full flex items-center gap-3 px-4 py-3 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl transition-all font-bold"
					>
						<Smartphone class="w-5 h-5" /> Sair de todos os dispositivos
					</button>
				</div>
			</div>

			<!-- Settings Content -->
			<div class="md:col-span-2 space-y-6">
				<!-- Tab: Notifications -->
				<div v-if="activeTab === 'notifications'" class="space-y-6">
					<div class="premium-card">
						<h3 class="text-lg font-bold mb-6 flex items-center gap-2"><Bell class="w-5 h-5 text-primary-600" /> Canais de Notificação</h3>
						<div class="space-y-4">
							<div
								class="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-950 rounded-2xl border border-surface-200 dark:border-surface-800"
							>
								<div>
									<p class="font-bold text-surface-900 dark:text-white">Push Browser</p>
									<p class="text-xs text-surface-500">Alertas em tempo real no seu navegador.</p>
								</div>
								<label class="relative inline-flex items-center cursor-pointer">
									<input type="checkbox" v-model="preferencesStore.preferences.notificationsBrowser" class="sr-only peer" />
									<div
										class="w-11 h-6 bg-surface-300 peer-focus:outline-none rounded-full peer dark:bg-surface-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"
									></div>
								</label>
							</div>
							<div
								class="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-950 rounded-2xl border border-surface-200 dark:border-surface-800"
							>
								<div>
									<p class="font-bold text-surface-900 dark:text-white">WhatsApp</p>
									<p class="text-xs text-surface-500">Relatórios semanais e links rápidos.</p>
								</div>
								<label class="relative inline-flex items-center cursor-pointer">
									<input type="checkbox" v-model="preferencesStore.preferences.notificationsWhatsapp" class="sr-only peer" />
									<div
										class="w-11 h-6 bg-surface-300 peer-focus:outline-none rounded-full peer dark:bg-surface-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"
									></div>
								</label>
							</div>
						</div>
					</div>

					<div class="premium-card">
						<h3 class="text-lg font-bold mb-6 flex items-center gap-2"><Sun class="w-5 h-5 text-primary-600" /> Aparência e Tema</h3>
						<div class="grid grid-cols-2 gap-4">
							<button
								@click="preferencesStore.updatePreferences({ appearanceTheme: 'light' })"
								class="flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all"
								:class="
									preferencesStore.preferences.appearanceTheme === 'light'
										? 'border-primary-600 bg-primary-50 dark:bg-primary-900/10'
										: 'border-surface-200 dark:border-surface-800'
								"
							>
								<div class="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-amber-500">
									<Sun class="w-6 h-6" />
								</div>
								<span class="text-sm font-bold">Modo Claro</span>
							</button>
							<button
								@click="preferencesStore.updatePreferences({ appearanceTheme: 'dark' })"
								class="flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all"
								:class="
									preferencesStore.preferences.appearanceTheme === 'dark'
										? 'border-primary-600 bg-primary-50 dark:bg-primary-900/10'
										: 'border-surface-200 dark:border-surface-800'
								"
							>
								<div class="w-10 h-10 rounded-full bg-surface-950 shadow-sm flex items-center justify-center text-indigo-400">
									<Moon class="w-6 h-6" />
								</div>
								<span class="text-sm font-bold">Modo Escuro</span>
							</button>
						</div>
					</div>
				</div>

				<!-- Tab: Privacy -->
				<div v-if="activeTab === 'privacy'" class="space-y-6">
					<div class="premium-card">
						<h3 class="text-lg font-bold mb-6 flex items-center gap-2"><Eye class="w-5 h-5 text-primary-600" /> Privacidade de Dados</h3>
						<div class="space-y-4">
							<div
								class="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-950 rounded-2xl border border-surface-200 dark:border-surface-800"
							>
								<div>
									<p class="font-bold text-surface-900 dark:text-white">Busca Semântica</p>
									<p class="text-xs text-surface-500">Permitir que memórias antigas apareçam em buscas rápidas.</p>
								</div>
								<label class="relative inline-flex items-center cursor-pointer">
									<input type="checkbox" v-model="preferencesStore.preferences.privacyShowMemoriesInSearch" class="sr-only peer" />
									<div
										class="w-11 h-6 bg-surface-300 peer-focus:outline-none rounded-full peer dark:bg-surface-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"
									></div>
								</label>
							</div>
						</div>
					</div>
				</div>

				<!-- Tab: Security -->
				<div v-if="activeTab === 'security'" class="space-y-6">
					<div class="premium-card">
						<h3 class="text-lg font-bold mb-6 flex items-center gap-2"><Lock class="w-5 h-5 text-primary-600" /> Segurança</h3>
						<p class="text-sm text-surface-500 mb-6">Suas chaves de API e conexões são criptografadas ponta a ponta.</p>
						<button
							class="px-5 py-2.5 bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-white rounded-xl font-bold text-sm hover:bg-surface-200 transition-all border border-surface-200 dark:border-surface-800"
						>
							Alterar Chave Mestre
						</button>
					</div>
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

.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
