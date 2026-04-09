<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useDashboard } from '~/composables/useDashboard'

definePageMeta({
  middleware: ['role']
})

const dashboard = useDashboard()
const toast = useToast()
const queryClient = useQueryClient()

const { data: settings, isLoading } = useQuery({
  queryKey: ['whatsapp-settings'],
  queryFn: () => dashboard.getWhatsAppSettings()
})

const { data: qrCodeData, refetch: refetchQRCode } = useQuery({
  queryKey: ['whatsapp-qr-code'],
  queryFn: () => dashboard.getWhatsAppQRCode(),
  refetchInterval: 4000
})

const connectionStatus = computed(() => {
  const fromQr = qrCodeData.value?.connectionStatus
  if (fromQr?.status) {
    return fromQr
  }

  return {
    status: settings.value?.connectionStatus || 'disconnected',
    phoneNumber: settings.value?.phoneNumber || null,
    error: settings.value?.lastError || null
  }
})

const isConnected = computed(() => connectionStatus.value.status === 'connected')
const isConnecting = computed(() => connectionStatus.value.status === 'connecting')
const statusLabel = computed(() => {
  if (isConnected.value) return 'Conectado'
  if (isConnecting.value) return 'Conectando'
  if (connectionStatus.value.status === 'error') return 'Erro'
  return 'Desconectado'
})

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

const bootstrapMutation = useMutation({
  mutationFn: async () => dashboard.bootstrapWhatsAppInstance(),
  onSuccess: async () => {
    toast.add({
      title: 'Instância pronta',
      description: 'Bootstrap da instância Evolution executado com sucesso.',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
    await queryClient.invalidateQueries({ queryKey: ['whatsapp-settings'] })
    await refetchQRCode()
  },
  onError: (error: unknown) => {
    toast.add({
      title: 'Falha no bootstrap',
      description: getErrorMessage(error, 'Não foi possível executar bootstrap da instância.'),
      color: 'error',
      icon: 'i-heroicons-x-circle'
    })
  }
})

const connectMutation = useMutation({
  mutationFn: async () => dashboard.connectWhatsAppInstance(),
  onSuccess: async () => {
    toast.add({
      title: 'Conexão solicitada',
      description: 'QR Code atualizado para vinculação do WhatsApp.',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
    await refetchQRCode()
  },
  onError: (error: unknown) => {
    toast.add({
      title: 'Erro ao conectar',
      description: getErrorMessage(error, 'Não foi possível iniciar a conexão.'),
      color: 'error',
      icon: 'i-heroicons-x-circle'
    })
  }
})

const restartMutation = useMutation({
  mutationFn: async () => dashboard.restartWhatsAppInstance(),
  onSuccess: async () => {
    toast.add({
      title: 'Instância reiniciada',
      description: 'Sessão reiniciada e QR Code renovado.',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
    await refetchQRCode()
    await queryClient.invalidateQueries({ queryKey: ['whatsapp-settings'] })
  },
  onError: (error: unknown) => {
    toast.add({
      title: 'Erro ao reiniciar',
      description: getErrorMessage(error, 'Não foi possível reiniciar a instância.'),
      color: 'error',
      icon: 'i-heroicons-x-circle'
    })
  }
})

const disconnectMutation = useMutation({
  mutationFn: async () => dashboard.disconnectWhatsAppInstance(),
  onSuccess: async () => {
    toast.add({
      title: 'Sessão desconectada',
      description: 'A sessão WhatsApp foi encerrada com sucesso.',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
    await refetchQRCode()
    await queryClient.invalidateQueries({ queryKey: ['whatsapp-settings'] })
  },
  onError: (error: unknown) => {
    toast.add({
      title: 'Erro ao desconectar',
      description: getErrorMessage(error, 'Não foi possível desconectar a sessão.'),
      color: 'error',
      icon: 'i-heroicons-x-circle'
    })
  }
})

const clearCacheMutation = useMutation({
  mutationFn: async () => dashboard.clearWhatsAppCache(),
  onSuccess: () => {
    toast.add({
      title: 'Cache limpo',
      description: 'Cache do provider foi limpo com sucesso.',
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
  },
  onError: (error: unknown) => {
    toast.add({
      title: 'Erro ao limpar cache',
      description: getErrorMessage(error, 'Não foi possível limpar o cache.'),
      color: 'error',
      icon: 'i-heroicons-x-circle'
    })
  }
})
</script>

<template>
  <div class="space-y-8 animate-fade-in">
    <div>
      <h2 class="text-3xl font-black text-surface-900 dark:text-white uppercase tracking-tight">
        WhatsApp Evolution
      </h2>
      <p class="text-surface-500 dark:text-surface-400 mt-1">
        Operação da instância Evolution para ambiente de desenvolvimento.
      </p>
    </div>

    <div
      v-if="isLoading"
      class="h-52 rounded-2xl bg-surface-100 dark:bg-surface-800 animate-pulse"
    />

    <template v-else>
      <div class="premium-card p-8!">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p class="text-xs font-black uppercase text-surface-500">
              Provider Ativo
            </p>
            <p class="text-2xl font-black text-surface-900 dark:text-white">
              EVOLUTION
            </p>
          </div>
          <div
            class="px-3 py-1 rounded-lg text-xs font-black uppercase"
            :class="{
              'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300': isConnected,
              'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300': isConnecting,
              'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300': !isConnected && !isConnecting
            }"
          >
            {{ statusLabel }}
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div>
            <p class="text-xs font-black uppercase text-surface-500">
              Número Conectado
            </p>
            <p class="text-sm font-semibold text-surface-900 dark:text-white mt-1">
              {{ connectionStatus.phoneNumber || 'Não conectado' }}
            </p>
          </div>
          <div>
            <p class="text-xs font-black uppercase text-surface-500">
              Última Atualização
            </p>
            <p class="text-sm font-semibold text-surface-900 dark:text-white mt-1">
              {{ settings?.updatedAt ? new Date(settings.updatedAt).toLocaleString('pt-BR') : '-' }}
            </p>
          </div>
          <div>
            <p class="text-xs font-black uppercase text-surface-500">
              Erro Atual
            </p>
            <p class="text-sm font-semibold text-surface-900 dark:text-white mt-1">
              {{ connectionStatus.error || 'Sem erros' }}
            </p>
          </div>
        </div>
      </div>

      <div class="premium-card p-8!">
        <h3 class="text-xl font-black text-surface-900 dark:text-white">
          Vinculação
        </h3>

        <div
          v-if="!isConnected && qrCodeData?.qrCode"
          class="mt-6 flex flex-col items-center gap-4"
        >
          <div class="bg-white p-4 rounded-xl border border-surface-200">
            <img
              :src="`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData?.qrCode || '')}`"
              alt="QR Code WhatsApp Evolution"
              class="w-64 h-64"
            >
          </div>
          <p
            v-if="qrCodeData?.pairingCode"
            class="text-sm font-semibold text-surface-700 dark:text-surface-300"
          >
            Código de pareamento: {{ qrCodeData.pairingCode }}
          </p>
          <p class="text-sm text-surface-500 text-center max-w-lg">
            Abra o WhatsApp no celular, vá em aparelhos conectados e escaneie o QR Code para concluir a sessão.
          </p>
        </div>

        <div
          v-else-if="isConnected"
          class="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 p-4"
        >
          <p class="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Instância conectada e pronta para receber e enviar mensagens.
          </p>
        </div>

        <div
          v-else
          class="mt-6 rounded-xl border border-surface-200 dark:border-surface-800 p-4"
        >
          <p class="text-sm text-surface-600 dark:text-surface-300">
            Ainda não há QR Code ativo. Clique em "Conectar" para iniciar.
          </p>
        </div>
      </div>

      <div class="premium-card p-8!">
        <h3 class="text-xl font-black text-surface-900 dark:text-white">
          Ações Operacionais
        </h3>
        <div class="mt-6 flex flex-wrap gap-3">
          <button
            class="px-4 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-900 dark:text-white font-semibold disabled:opacity-50"
            :disabled="bootstrapMutation.isPending.value"
            @click="bootstrapMutation.mutate()"
          >
            Bootstrap Instância
          </button>
          <button
            class="px-4 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-900 dark:text-white font-semibold disabled:opacity-50"
            :disabled="connectMutation.isPending.value"
            @click="connectMutation.mutate()"
          >
            Conectar
          </button>
          <button
            class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
            :disabled="restartMutation.isPending.value"
            @click="restartMutation.mutate()"
          >
            Reiniciar Sessão
          </button>
          <button
            class="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-semibold disabled:opacity-50"
            :disabled="disconnectMutation.isPending.value"
            @click="disconnectMutation.mutate()"
          >
            Desconectar
          </button>
          <button
            class="px-4 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-900 dark:text-white font-semibold disabled:opacity-50"
            :disabled="clearCacheMutation.isPending.value"
            @click="clearCacheMutation.mutate()"
          >
            Limpar Cache
          </button>
        </div>
      </div>

      <div class="premium-card p-6! bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <p class="text-sm text-blue-800 dark:text-blue-200">
          Webhook oficial em desenvolvimento: <strong>/webhook/whatsapp/evolution</strong>. O header de autenticação deve usar o segredo
          configurado em <strong>EVOLUTION_WEBHOOK_SECRET</strong>.
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.35s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
