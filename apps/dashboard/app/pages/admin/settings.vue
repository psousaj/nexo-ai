<script setup lang="ts">
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useDashboard } from '~/composables/useDashboard';
import { useToast } from '~/composables/useToast';
import { ref } from 'vue';

definePageMeta({
	middleware: ['role'],
});

const dashboard = useDashboard();
const toast = useToast();
const queryClient = useQueryClient();

const isChangingApi = ref(false);
const selectedApi = ref<'meta' | 'baileys'>('meta');

// Fetch current settings
const { data: settings, isLoading } = useQuery({
	queryKey: ['whatsapp-settings'],
	queryFn: () => dashboard.getWhatsAppSettings(),
	onSuccess: (data) => {
		selectedApi.value = data.activeApi;
	},
});

// Mutation to change API
const changeApiMutation = useMutation({
	mutationFn: async (api: 'meta' | 'baileys') => {
		isChangingApi.value = true;
		return await dashboard.setWhatsAppApi(api);
	},
	onSuccess: (data) => {
		toast.success(`API WhatsApp alterada para ${data.activeApi.toUpperCase()}`);
		queryClient.invalidateQueries({ queryKey: ['whatsapp-settings'] });
	},
	onError: (error: any) => {
		toast.error(error.message || 'Erro ao alterar API WhatsApp');
	},
	onSettled: () => {
		isChangingApi.value = false;
	},
});

// Mutation to clear cache
const clearCacheMutation = useMutation({
	mutationFn: async () => {
		return await dashboard.clearWhatsAppCache();
	},
	onSuccess: () => {
		toast.success('Cache do WhatsApp limpo com sucesso');
	},
	onError: (error: any) => {
		toast.error(error.message || 'Erro ao limpar cache');
	},
});

const handleApiChange = async (api: 'meta' | 'baileys') => {
	if (api === selectedApi.value) return;

	const confirmed = confirm(
		`Tem certeza que deseja alterar a API WhatsApp para ${api.toUpperCase()}?\n\n` +
			`Meta API: Oficial do Facebook (requer Business Account)\n` +
			`Baileys: Não-oficial via QR Code (OpenClaw-style)`,
	);

	if (confirmed) {
		changeApiMutation.mutate(api);
	}
};

const handleClearCache = () => {
	clearCacheMutation.mutate();
};
</script>

<template>
	<div class="space-y-8 animate-fade-in">
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
			<div>
				<h2 class="text-3xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic">
					Configurações WhatsApp
				</h2>
				<p class="text-surface-500 dark:text-surface-400 mt-1">
					Selecione qual API do WhatsApp usar para envio de mensagens
				</p>
			</div>
		</div>

		<div v-if="isLoading" class="grid grid-cols-1 gap-6 animate-pulse">
			<div class="h-64 bg-surface-100 dark:bg-surface-800 rounded-2xl"></div>
		</div>

		<template v-else>
			<!-- API Selector Card -->
			<div class="premium-card !p-8">
				<h3 class="text-xl font-black text-surface-900 dark:text-white mb-6">API Ativa</h3>

				<!-- Meta API Option -->
				<div
					class="relative border-2 rounded-2xl p-6 transition-all cursor-pointer mb-4"
					:class="
						selectedApi === 'meta'
							? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
							: 'border-surface-200 dark:border-surface-800 hover:border-surface-300'
					"
					@click="handleApiChange('meta')"
				>
					<div class="flex items-start justify-between">
						<div class="flex items-start gap-4">
							<div
								class="w-12 h-12 rounded-xl flex items-center justify-center"
								:class="
									selectedApi === 'meta'
										? 'bg-primary-500 text-white'
										: 'bg-surface-100 dark:bg-surface-800 text-surface-600'
								"
							>
								<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
									<path
										d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 6.46 17.5 2 12.04 2M12.05 3.67C16.46 3.67 20.08 7.29 20.08 11.7C20.08 16.11 16.46 19.73 12.05 19.73C10.47 19.73 8.92 19.34 7.54 18.6L4.07 19.48L4.97 16.08C4.23 14.75 3.84 13.25 3.84 11.7C3.84 7.29 7.46 3.67 12.05 3.67Z"
									/>
								</svg>
							</div>
							<div>
								<div class="flex items-center gap-2">
									<h4 class="text-lg font-black text-surface-900 dark:text-white">Meta WhatsApp Business API</h4>
									<span
										v-if="selectedApi === 'meta'"
										class="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-primary-500 text-white"
									>
										Ativa
									</span>
								</div>
								<p class="text-sm text-surface-500 mt-1">API oficial do Facebook (Cloud-hosted)</p>
								<ul class="mt-3 space-y-1">
									<li class="text-xs text-surface-600 dark:text-surface-400 flex items-center gap-2">
										<span class="text-emerald-500">✓</span>
										Oficial, sem risco de ban
									</li>
									<li class="text-xs text-surface-600 dark:text-surface-400 flex items-center gap-2">
										<span class="text-emerald-500">✓</span>
										Suporte do Meta
									</li>
									<li class="text-xs text-surface-600 dark:text-surface-400 flex items-center gap-2">
										<span class="text-emerald-500">✓</span>
										Requer Business Account
									</li>
								</ul>
							</div>
						</div>
						<div
							class="w-6 h-6 rounded-full border-2 flex items-center justify-center"
							:class="
								selectedApi === 'meta'
									? 'border-primary-500 bg-primary-500'
									: 'border-surface-300 dark:border-surface-700'
							"
						>
							<div
								v-if="selectedApi === 'meta'"
								class="w-3 h-3 rounded-full bg-white"
							></div>
						</div>
					</div>
				</div>

				<!-- Baileys Option -->
				<div
					class="relative border-2 rounded-2xl p-6 transition-all cursor-pointer"
					:class="
						selectedApi === 'baileys'
							? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
							: 'border-surface-200 dark:border-surface-800 hover:border-surface-300'
					"
					@click="handleApiChange('baileys')"
				>
					<div class="flex items-start justify-between">
						<div class="flex items-start gap-4">
							<div
								class="w-12 h-12 rounded-xl flex items-center justify-center"
								:class="
									selectedApi === 'baileys'
										? 'bg-primary-500 text-white'
										: 'bg-surface-100 dark:bg-surface-800 text-surface-600'
								"
							>
								<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
							<div>
								<div class="flex items-center gap-2">
									<h4 class="text-lg font-black text-surface-900 dark:text-white">Baileys (OpenClaw-style)</h4>
									<span
										v-if="selectedApi === 'baileys'"
										class="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-primary-500 text-white"
									>
										Ativa
									</span>
								</div>
								<p class="text-sm text-surface-500 mt-1">API não-oficial via WebSocket (Self-hosted)</p>
								<ul class="mt-3 space-y-1">
									<li class="text-xs text-surface-600 dark:text-surface-400 flex items-center gap-2">
										<span class="text-emerald-500">✓</span>
										Autenticação via QR Code
									</li>
									<li class="text-xs text-surface-600 dark:text-surface-400 flex items-center gap-2">
										<span class="text-emerald-500">✓</span>
										Sem Business Account
									</li>
									<li class="text-xs text-surface-600 dark:text-surface-400 flex items-center gap-2">
										<span class="text-amber-500">⚠</span>
										Risco de ban (não-oficial)
									</li>
								</ul>
							</div>
						</div>
						<div
							class="w-6 h-6 rounded-full border-2 flex items-center justify-center"
							:class="
								selectedApi === 'baileys'
									? 'border-primary-500 bg-primary-500'
									: 'border-surface-300 dark:border-surface-700'
							"
						>
							<div
								v-if="selectedApi === 'baileys'"
								class="w-3 h-3 rounded-full bg-white"
							></div>
						</div>
					</div>
				</div>
			</div>

			<!-- Connection Status Card -->
			<div class="premium-card !p-8">
				<h3 class="text-xl font-black text-surface-900 dark:text-white mb-6">Status de Conexão</h3>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<!-- Status -->
					<div class="space-y-2">
						<p class="text-xs font-black text-surface-500 uppercase">API Selecionada</p>
						<div class="flex items-center gap-2">
							<span class="text-2xl font-black text-primary-600 uppercase">
								{{ settings?.activeApi }}
							</span>
							<div
								class="w-2 h-2 rounded-full"
								:class="selectedApi === 'baileys' && settings?.baileysConnectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'"
							></div>
						</div>
					</div>

					<!-- Phone Number -->
					<div class="space-y-2">
						<p class="text-xs font-black text-surface-500 uppercase">Número Conectado</p>
						<p class="text-sm font-medium text-surface-900 dark:text-white">
							{{ settings?.baileysPhoneNumber || settings?.metaPhoneNumberId || 'Não conectado' }}
						</p>
					</div>

					<!-- Last Update -->
					<div class="space-y-2">
						<p class="text-xs font-black text-surface-500 uppercase">Última Atualização</p>
						<p class="text-sm font-medium text-surface-900 dark:text-white">
							{{ settings?.updatedAt ? new Date(settings.updatedAt).toLocaleString('pt-BR') : '-' }}
						</p>
					</div>

					<!-- Error -->
					<div v-if="settings?.lastError" class="space-y-2">
						<p class="text-xs font-black text-rose-500 uppercase">Último Erro</p>
						<p class="text-sm text-rose-600">{{ settings.lastError }}</p>
					</div>
				</div>
			</div>

			<!-- Actions Card -->
			<div class="premium-card !p-8">
				<h3 class="text-xl font-black text-surface-900 dark:text-white mb-6">Ações</h3>

				<div class="flex flex-wrap gap-4">
					<button
						:disabled="clearCacheMutation.isPending.value"
						class="px-6 py-3 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-900 dark:text-white font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
						@click="handleClearCache"
					>
						<svg v-if="!clearCacheMutation.isPending.value" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
						</svg>
						<svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Limpar Cache
					</button>

					<a
						href="https://github.com/openclaw/openclaw"
						target="_blank"
						rel="noopener noreferrer"
						class="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl transition-all flex items-center gap-2"
					>
						<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
							<path
								d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-.522-.624-1.412-.876-2.614l-.236-1.074c-.233-1.054-.633-1.744-1.189-2.07-.559-.326-1.179-.231-1.486.229l-.008.011c-.357.508-.519 1.102-.487 1.746.016.319.045.637.088.954l.036.269c.356 2.618 1.86 4.299 4.021 4.713.18.037.293.206.293.416 0 .431-.348.828-.855.828-.478 0-.858-.34-.858-.753 0-.256.127-.487.327-.62.253-.172.567-.199.854-.084.537.217.971.672 1.391 1.395.435.752.824 1.391 1.18 1.391.809 0 2.665-1.163 3.23-2.509.304-.709.093-1.423.137-2.137.067-2.956-.072-.373-.179-.745-.321-1.112-.69-1.741-2.064-2.354-3.875-1.809-1.904.562-3.229 2.064-3.229 2.064-.217.242-.427.54-.627.852-.201.242-.394.501-.627.733-.225.222-.415.426-.536.577-.121.151-.209.255-.238.34-.106.257.13.389.368.389.618 0 .498-.405.904-.904.904-.5 0-.904-.406-.904-.904 0-.27.114-.531.303-.743.33-.366.771-.676 1.229-.923.457-.247.94-.385 1.394-.415.463-.031.928.024 1.384.163.459.139.916.321 1.367.546.448.224.898.447 1.345.671.892.419 1.776.842 2.653 1.266.877.424 1.756.848 2.629 1.269z"
							/>
						</svg>
						Ver Documentação OpenClaw
					</a>
				</div>
			</div>

			<!-- Info Card -->
			<div class="premium-card !p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
				<div class="flex gap-4">
					<div class="text-blue-600 dark:text-blue-400">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div class="flex-1">
						<h4 class="font-bold text-blue-900 dark:text-blue-100">Sobre as APIs</h4>
						<p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
							<strong>Meta API:</strong> Oficial do Facebook, requer WhatsApp Business Account e telefone verificado.<br />
							<strong>Baileys:</strong> Implementação não-oficial estilo OpenClaw, usa QR Code para conexão direta.
						</p>
					</div>
				</div>
			</div>
		</template>
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
