<script setup lang="ts">
import { ref } from 'vue';
import { Bell, Shield, Eye, Languages, Moon, Sun, Lock, Smartphone } from 'lucide-vue-next';

const preferences = ref({
	notifications: {
		browser: true,
		whatsapp: true,
		email: false,
	},
	privacy: {
		showMemoriesInSearch: false,
		shareAnalyticsWithTeam: true,
	},
	appearance: {
		theme: 'dark',
		language: 'pt-BR',
	},
});
</script>

<template>
	<div class="max-w-4xl mx-auto space-y-8 animate-fade-in">
		<div class="flex flex-col gap-2">
			<h2 class="text-3xl font-black text-surface-900 dark:text-white uppercase tracking-tighter">Preferências</h2>
			<p class="text-surface-500 dark:text-surface-400">Personalize como o Nexo AI interage com você.</p>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
			<!-- Sidebar Nav -->
			<div class="space-y-2">
				<button
					class="w-full flex items-center gap-3 px-4 py-3 bg-primary-600 text-white rounded-xl shadow-lg shadow-primary-600/20 font-bold"
				>
					<Bell class="w-5 h-5" /> Notificações
				</button>
				<button
					class="w-full flex items-center gap-3 px-4 py-3 text-surface-600 dark:text-surface-400 hover:bg-white dark:hover:bg-surface-900 rounded-xl transition-all font-medium border border-transparent hover:border-surface-200 dark:hover:border-surface-800"
				>
					<Lock class="w-5 h-5" /> Segurança
				</button>
				<button
					class="w-full flex items-center gap-3 px-4 py-3 text-surface-600 dark:text-surface-400 hover:bg-white dark:hover:bg-surface-900 rounded-xl transition-all font-medium border border-transparent hover:border-surface-200 dark:hover:border-surface-800"
				>
					<Eye class="w-5 h-5" /> Privacidade
				</button>
			</div>

			<!-- Settings Content -->
			<div class="md:col-span-2 space-y-6">
				<!-- Notifications -->
				<div class="premium-card">
					<h3 class="text-lg font-bold mb-6 flex items-center gap-2"><Bell class="w-5 h-5 text-primary-600" /> Canais de Notificação</h3>

					<div class="space-y-4">
						<div
							v-for="(val, key) in preferences.notifications"
							:key="key"
							class="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800"
						>
							<div>
								<p class="font-bold text-surface-900 dark:text-white capitalize">{{ key }}</p>
								<p class="text-xs text-surface-500">Receba alertas e lembretes via {{ key }}</p>
							</div>

							<label class="relative inline-flex items-center cursor-pointer">
								<input type="checkbox" v-model="preferences.notifications[key]" class="sr-only peer" />
								<div
									class="w-11 h-6 bg-surface-300 peer-focus:outline-none rounded-full peer dark:bg-surface-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"
								></div>
							</label>
						</div>
					</div>
				</div>

				<!-- Appearance -->
				<div class="premium-card">
					<h3 class="text-lg font-bold mb-6 flex items-center gap-2"><Sun class="w-5 h-5 text-primary-600" /> Aparência e Idioma</h3>

					<div class="space-y-6">
						<div class="grid grid-cols-2 gap-4">
							<button
								class="flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all"
								:class="
									preferences.appearance.theme === 'light'
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
								class="flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all"
								:class="
									preferences.appearance.theme === 'dark'
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

						<div>
							<label class="block text-sm font-bold text-surface-500 mb-2 uppercase tracking-wide">Idioma</label>
							<select
								class="w-full px-4 py-3 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all font-medium"
							>
								<option value="pt-BR">Português (Brasil)</option>
								<option value="en-US">English (US)</option>
								<option value="es">Español</option>
							</select>
						</div>
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
</style>
