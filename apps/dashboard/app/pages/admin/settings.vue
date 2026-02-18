<script setup lang="ts">
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { useDashboard } from '~/composables/useDashboard';
import { ref, computed, watchEffect, watch } from 'vue';

definePageMeta({
	middleware: ['role'],
});

const dashboard = useDashboard();
const toast = useToast(); // Auto-imported from Nuxt UI
const queryClient = useQueryClient();

const isChangingApi = ref(false);
const selectedApi = ref<'meta' | 'baileys'>('meta');

// Fetch current settings
const { data: settings, isLoading } = useQuery({
	queryKey: ['whatsapp-settings'],
	queryFn: () => dashboard.getWhatsAppSettings(),
});

// Update selectedApi when settings change
watchEffect(() => {
	if (settings.value) {
		selectedApi.value = settings.value.activeApi;
	}
});

// Mutation to change API
const changeApiMutation = useMutation({
	mutationFn: async (api: 'meta' | 'baileys') => {
		isChangingApi.value = true;
		const result = await dashboard.setWhatsAppApi(api);
		return result;
	},
	onSuccess: (data) => {
		toast.add({
			title: 'API WhatsApp Alterada',
			description: `API alterada para ${data.activeApi.toUpperCase()} com sucesso`,
			color: 'success',
			icon: 'i-heroicons-check-circle',
		});
		queryClient.invalidateQueries({ queryKey: ['whatsapp-settings'] });
	},
	onError: (error: any) => {
		toast.add({
			title: 'Erro ao alterar API',
			description: error.message || 'Erro ao alterar API WhatsApp',
			color: 'error',
			icon: 'i-heroicons-x-circle',
		});
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
		toast.add({
			title: 'Cache Limpo',
			description: 'Cache do WhatsApp limpo com sucesso',
			color: 'success',
			icon: 'i-heroicons-check-circle',
		});
	},
	onError: (error: any) => {
		toast.add({
			title: 'Erro ao limpar cache',
			description: error.message || 'Erro ao limpar cache',
			color: 'error',
			icon: 'i-heroicons-x-circle',
		});
	},
});

// Mutation to restart Baileys connection
const restartBaileysMutation = useMutation({
	mutationFn: async () => {
		const response = await fetch(`${import.meta.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/admin/whatsapp-settings/baileys/restart`, {
			method: 'POST',
			credentials: 'include',
		});
		if (!response.ok) {
			throw new Error('Erro ao reiniciar conexão');
		}
		return response.json();
	},
	onSuccess: async () => {
		toast.add({
			title: 'Sessão Reiniciada',
			description: 'Novo QR Code gerado! Escaneie em até 30 segundos.',
			color: 'success',
			icon: 'i-heroicons-check-circle',
		});
		// Recarregar QR Code múltiplas vezes para garantir que pegamos o novo
		await refetchQRCode();
		setTimeout(() => refetchQRCode(), 500);
		setTimeout(() => refetchQRCode(), 1000);
	},
	onError: (error: any) => {
		toast.add({
			title: 'Erro ao reiniciar',
			description: error.message || 'Erro ao reiniciar conexão',
			color: 'error',
			icon: 'i-heroicons-x-circle',
		});
	},
});

// Mutation to disconnect Baileys
const disconnectBaileysMutation = useMutation({
	mutationFn: async () => {
		const response = await fetch(`${import.meta.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/admin/whatsapp-settings/baileys/disconnect`, {
			method: 'POST',
			credentials: 'include',
		});
		if (!response.ok) {
			throw new Error('Erro ao desconectar');
		}
		return response.json();
	},
	onSuccess: async () => {
		toast.add({
			title: 'Desconectado',
			description: 'Sessão Baileys desconectada com sucesso',
			color: 'success',
			icon: 'i-heroicons-check-circle',
		});
		// Refetch QR code and settings
		queryClient.invalidateQueries({ queryKey: ['whatsapp-settings'] });
		await refetchQRCode();
	},
	onError: (error: any) => {
		toast.add({
			title: 'Erro ao desconectar',
			description: error.message || 'Erro ao desconectar sessão',
			color: 'error',
			icon: 'i-heroicons-x-circle',
		});
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

const handleDisconnect = () => {
	const confirmed = confirm(
		'Tem certeza que deseja desconectar a conta Baileys?\n\n' +
		'Isso irá encerrar a sessão do WhatsApp. Você precisará escanear o QR Code novamente para reconectar.',
	);

	if (confirmed) {
		disconnectBaileysMutation.mutate();
	}
};

// Fetch QR Code when Baileys is selected
const { data: qrCodeData, refetch: refetchQRCode } = useQuery({
	queryKey: ['whatsapp-qr-code', selectedApi],
	queryFn: () => dashboard.getWhatsAppQRCode(),
	enabled: computed(() => selectedApi.value === 'baileys'),
	refetchInterval: computed(() => selectedApi.value === 'baileys' ? 2000 : false),
});

// Connection status computed from QR code data
const baileysConnectionStatus = computed(() => {
	if (!qrCodeData.value?.connectionStatus) return null;
	const { status, phoneNumber, error } = qrCodeData.value.connectionStatus;
	return {
		status,
		phoneNumber,
		error,
	};
});

// Watch for API changes and refetch QR code when Baileys is selected
watch(selectedApi, (newApi) => {
	if (newApi === 'baileys') {
		refetchQRCode();
	}
});

// Watch for connection status changes - auto-reload on error/disconnect
watch(baileysConnectionStatus, (newStatus) => {
	if (newStatus && (newStatus.status === 'error' || newStatus.status === 'disconnected')) {
		// Recarregar QR Code para tentar pegar um novo
		setTimeout(() => refetchQRCode(), 1000);
	}
});
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

			<!-- QR Code Card (Baileys only) -->
			<div v-if="selectedApi === 'baileys'" class="premium-card !p-8">
				<h3 class="text-xl font-black text-surface-900 dark:text-white mb-6">QR Code de Conexão</h3>

				<!-- Connection Status -->
				<div v-if="baileysConnectionStatus" class="mb-6 p-4 rounded-lg" :class="{
					'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800': baileysConnectionStatus.status === 'connected',
					'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800': baileysConnectionStatus.status === 'connecting',
					'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800': baileysConnectionStatus.status === 'error' || baileysConnectionStatus.status === 'disconnected',
				}">
					<div class="flex items-center gap-3">
						<div v-if="baileysConnectionStatus.status === 'connected'" class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
						<div v-else-if="baileysConnectionStatus.status === 'connecting'" class="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></div>
						<div v-else class="w-3 h-3 rounded-full bg-rose-500"></div>
						<div>
							<p class="text-sm font-bold" :class="{
								'text-emerald-900 dark:text-emerald-100': baileysConnectionStatus.status === 'connected',
								'text-amber-900 dark:text-amber-100': baileysConnectionStatus.status === 'connecting',
								'text-rose-900 dark:text-rose-100': baileysConnectionStatus.status === 'error' || baileysConnectionStatus.status === 'disconnected',
							}">
								{{ baileysConnectionStatus.status === 'connected' ? '🟢 Conectado' : '' }}
								{{ baileysConnectionStatus.status === 'connecting' ? '🟡 Conectando...' : '' }}
								{{ baileysConnectionStatus.status === 'disconnected' ? '🔴 Desconectado' : '' }}
								{{ baileysConnectionStatus.status === 'error' ? '❌ Erro' : '' }}
							</p>
							<p v-if="baileysConnectionStatus.phoneNumber" class="text-xs text-surface-600 dark:text-surface-400 mt-1">
								📱 {{ baileysConnectionStatus.phoneNumber }}
							</p>
							<p v-if="baileysConnectionStatus.error" class="text-xs text-rose-700 dark:text-rose-300 mt-1">
								{{ baileysConnectionStatus.error }}
							</p>
						</div>
					</div>
				</div>

				<div v-if="!qrCodeData?.qrCode && baileysConnectionStatus?.status !== 'connected'" class="text-center py-8">
					<p class="text-surface-500 dark:text-surface-400 mb-4">
						📱 Aguardando QR Code... O servidor está conectando ao WhatsApp.
					</p>
					<button
						@click="() => refetchQRCode()"
						class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
					>
						Atualizar
					</button>
				</div>

				<!-- Show error and restart button -->
				<div v-else-if="baileysConnectionStatus?.status === 'error' || baileysConnectionStatus?.status === 'disconnected'" class="text-center py-8">
					<p class="text-rose-600 dark:text-rose-400 text-lg font-medium mb-4">
						❌ Erro na conexão WhatsApp
					</p>
					<p v-if="baileysConnectionStatus.error" class="text-sm text-surface-600 dark:text-surface-400 mb-6">
						{{ baileysConnectionStatus.error }}
					</p>
					<div class="flex flex-col sm:flex-row gap-3 justify-center">
						<button
							:disabled="restartBaileysMutation.isPending.value"
							@click="() => restartBaileysMutation.mutate()"
							class="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<svg v-if="!restartBaileysMutation.isPending.value" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
							</svg>
							<svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Gerar Novo QR Code
						</button>
						<button
							@click="() => refetchQRCode()"
							class="px-6 py-3 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-900 dark:text-white font-bold rounded-xl transition-all"
						>
							Verificar Status
						</button>
					</div>
					<p class="text-xs text-surface-500 dark:text-surface-400 mt-4">
						💡 Clique em "Gerar Novo QR Code" para limpar a sessão e tentar novamente
					</p>
				</div>

				<div v-else-if="baileysConnectionStatus?.status !== 'connected'" class="flex flex-col items-center gap-4">
					<div class="bg-white p-4 rounded-xl shadow-lg">
						<img :src="`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData.qrCode)}`"
						     alt="WhatsApp QR Code"
						     class="w-64 h-64" />
					</div>
					<div class="text-center max-w-md">
						<p class="text-sm text-surface-600 dark:text-surface-400">
							1. Abra o WhatsApp no seu celular<br />
							2. Toque em <strong>Menu</strong> ou <strong>Configurações</strong> e selecione <strong>Aparelhos conectados</strong><br />
							3. Toque em <strong>Conectar um aparelho</strong><br />
							4. Escaneie este QR Code
						</p>
						<p class="text-xs text-amber-600 dark:text-amber-400 mt-3">
							⏱️ O QR Code expira em ~30 segundos. Se não conectar, clique abaixo para gerar um novo.
						</p>
						<button
							:disabled="restartBaileysMutation.isPending.value"
							@click="() => restartBaileysMutation.mutate()"
							class="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{{ restartBaileysMutation.isPending.value ? 'Gerando...' : 'Gerar Novo QR Code' }}
						</button>
					</div>
				</div>

				<div v-else class="text-center py-8">
					<p class="text-emerald-600 dark:text-emerald-400 text-lg font-medium mb-2">
						✅ WhatsApp conectado com sucesso!
					</p>
					<p class="text-sm text-surface-600 dark:text-surface-400">
						Você pode enviar mensagens para o bot agora.
					</p>
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
						<svg v-if="!clearCacheMutation.isPending" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
						</svg>
						<svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Limpar Cache
					</button>

					<!-- Botão Desconectar Baileys -->
					<button
						v-if="selectedApi === 'baileys'"
						:disabled="disconnectBaileysMutation.isPending.value"
						class="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
						@click="handleDisconnect"
					>
						<svg v-if="!disconnectBaileysMutation.isPending.value" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
						</svg>
						<svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Desconectar
					</button>

					<!-- Botão Reiniciar Conexão Baileys -->
					<button
						v-if="selectedApi === 'baileys'"
						:disabled="restartBaileysMutation.isPending.value"
						class="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
						@click="() => restartBaileysMutation.mutate()"
					>
						<svg v-if="!restartBaileysMutation.isPending.value" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
						</svg>
						<svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Reiniciar Conexão
					</button>

					<a
						href="https://github.com/openclaw/openclaw"
						target="_blank"
						rel="noopener noreferrer"
						class="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl transition-all flex items-center gap-2"
					>
						<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
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
