<script setup lang="ts">
import { ref } from 'vue';
import { User, Mail, Link as LinkIcon, Smartphone, XCircle, Plus, MessageSquare } from 'lucide-vue-next';
import { useAuthStore } from '../store/auth';

const authStore = useAuthStore();

const connectedAccounts = ref([
	{ id: 'wa', name: 'WhatsApp', icon: Smartphone, status: 'connected', username: '+55 11 99999-9999' },
	{ id: 'tg', name: 'Telegram', icon: MessageSquare, status: 'disconnected', username: null },
	{ id: 'dc', name: 'Discord', icon: MessageSquare, status: 'disconnected', username: null },
]);

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
							{{ authStore.user?.name.charAt(0) }}
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
							class="w-full px-4 py-3 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all"
						/>
					</div>
					<div>
						<label class="block text-sm font-bold text-surface-500 mb-1.5 uppercase tracking-wider">E-mail</label>
						<input
							v-model="profileForm.email"
							type="email"
							class="w-full px-4 py-3 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all"
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
				<h3 class="text-xl font-bold flex items-center gap-2">
					<LinkIcon class="w-5 h-5 text-primary-600" />
					Contas Vinculadas
				</h3>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div
						v-for="account in connectedAccounts"
						:key="account.id"
						class="p-4 rounded-2xl border flex items-center justify-between group transition-all"
						:class="
							account.status === 'connected'
								? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/50'
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
								<p class="font-bold text-surface-900 dark:text-white">{{ account.name }}</p>
								<p class="text-sm text-surface-500">{{ account.username || 'Não vinculado' }}</p>
							</div>
						</div>

						<button
							v-if="account.status === 'connected'"
							class="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
						>
							<XCircle class="w-5 h-5" />
						</button>
						<button v-else class="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors">
							<Plus class="w-5 h-5" />
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
</style>
