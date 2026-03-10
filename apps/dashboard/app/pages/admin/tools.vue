<template>
	<div class="p-8 space-y-6">
		<!-- Header -->
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Gerenciar Tools</h1>
			<p class="mt-2 text-gray-600 dark:text-gray-400">
				Controle global de funcionalidades. Mudanças afetam <strong>todos os usuários</strong>.
			</p>
		</div>

		<!-- Alert de aviso -->
		<UAlert
			color="warning"
			variant="soft"
			icon="i-heroicons-exclamation-triangle"
			title="Atenção: Controle Global"
			description="Desabilitar uma tool impede todos os usuários de usá-la. Use com moderação."
		/>

		<!-- Stats -->
		<div v-if="stats" class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<UCard v-for="stat in statCards" :key="stat.label">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">{{ stat.label }}</p>
						<p class="text-2xl font-bold" :class="stat.valueClass">{{ stats[stat.key] }}</p>
					</div>
					<UIcon :name="stat.icon" class="w-8 h-8" :class="stat.iconClass" />
				</div>
			</UCard>
		</div>

		<!-- Bulk Actions -->
		<div class="flex gap-3">
			<UButton color="success" variant="soft" icon="i-heroicons-check-circle" :loading="isEnablingAll" @click="enableAllTools">
				Habilitar Todas
			</UButton>

			<UButton color="error" variant="soft" icon="i-heroicons-x-circle" :loading="isDisablingAll" @click="disableAllTools">
				Desabilitar Todas
			</UButton>

			<UButton variant="ghost" icon="i-heroicons-arrow-path" :loading="isLoading" @click="loadTools"> Recarregar </UButton>
		</div>

		<!-- System Tools -->
		<UCard>
			<template #header>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<UIcon name="i-heroicons-shield-exclamation" class="w-5 h-5 text-amber-600" />
						<h2 class="text-xl font-semibold">Tools de Sistema</h2>
					</div>
					<UBadge color="warning" variant="subtle">Toggleáveis com risco</UBadge>
				</div>
			</template>

			<UAlert
				color="warning"
				icon="i-heroicons-exclamation-triangle"
				title="Atenção: Tools de Sistema"
				description="Desabilitar tools de sistema pode causar bugs, instabilidade ou perda de funcionalidades críticas do assistente."
				class="mb-4"
			/>

			<div class="space-y-3">
				<div
					v-for="tool in systemTools"
					:key="tool.name"
					class="rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden"
					:class="tool.enabled ? 'bg-amber-50/30 dark:bg-amber-900/10' : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'"
				>
					<div class="flex items-center justify-between p-4">
						<div class="flex items-center gap-3">
							<span class="text-2xl">{{ tool.icon }}</span>
							<div>
								<div class="flex items-center gap-2">
									<p class="font-medium">{{ tool.label }}</p>
									<UBadge color="warning" variant="subtle" size="xs">sistema</UBadge>
								</div>
								<p class="text-sm text-gray-600 dark:text-gray-400">{{ tool.description }}</p>
							</div>
						</div>

						<USwitch
							:model-value="tool.enabled"
							:loading="updatingTool === tool.name"
							@update:model-value="toggleTool(tool.name, $event)"
						/>
					</div>

					<div v-if="!tool.enabled" class="px-4 pb-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
						<UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4 flex-shrink-0" />
						<span>Esta tool de sistema está <strong>desabilitada</strong> — funcionalidades críticas podem estar indisponíveis.</span>
					</div>
				</div>
			</div>
		</UCard>

		<!-- User Tools (Toggleable) -->
		<UCard>
			<template #header>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<UIcon name="i-heroicons-puzzle-piece" class="w-5 h-5 text-purple-600" />
						<h2 class="text-xl font-semibold">Tools de Usuário</h2>
					</div>
					<UBadge color="secondary" variant="subtle">Plugáveis</UBadge>
				</div>
			</template>

			<div class="space-y-3">
				<div
					v-for="tool in userTools"
					:key="tool.name"
					class="flex items-center justify-between p-4 rounded-lg border"
					:class="
						tool.enabled
							? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
							: 'border-gray-200 dark:border-gray-700'
					"
				>
					<div class="flex items-center gap-3">
						<span class="text-2xl">{{ tool.icon }}</span>
						<div>
							<p class="font-medium">{{ tool.label }}</p>
							<p class="text-sm text-gray-600 dark:text-gray-400">{{ tool.description }}</p>
						</div>
					</div>

					<USwitch :model-value="tool.enabled" :loading="updatingTool === tool.name" @update:model-value="toggleTool(tool.name, $event)" />
				</div>
			</div>
		</UCard>
	</div>
</template>

<script setup lang="ts">
import type { ToolDefinition } from '~/types';

definePageMeta({
	middleware: ['role'],
	layout: 'default',
});

interface ToolWithStatus extends ToolDefinition {
	enabled: boolean;
}

interface ToolsResponse {
	success: boolean;
	data: {
		tools: ToolWithStatus[];
		stats: {
			total: number;
			enabled: number;
			disabled: number;
			system: number;
			user: number;
		};
	};
}

const toast = useToast();
const { apiUrl } = useRuntimeConfig().public;

// State
const isLoading = ref(false);
const isEnablingAll = ref(false);
const isDisablingAll = ref(false);
const updatingTool = ref<string | null>(null);
const allTools = ref<ToolWithStatus[]>([]);
const stats = ref<ToolsResponse['data']['stats'] | null>(null);

// Computed
const systemTools = computed(() => allTools.value.filter((t) => t.category === 'system'));
const userTools = computed(() => allTools.value.filter((t) => t.category === 'user'));

const statCards = [
	{ key: 'total' as const, label: 'Total', icon: 'i-heroicons-cog-6-tooth', iconClass: 'text-gray-400', valueClass: '' },
	{
		key: 'enabled' as const,
		label: 'Habilitadas',
		icon: 'i-heroicons-check-circle',
		iconClass: 'text-green-400',
		valueClass: 'text-green-600',
	},
	{ key: 'disabled' as const, label: 'Desabilitadas', icon: 'i-heroicons-x-circle', iconClass: 'text-red-400', valueClass: 'text-red-600' },
	{
		key: 'system' as const,
		label: 'Sistema',
		icon: 'i-heroicons-shield-exclamation',
		iconClass: 'text-amber-400',
		valueClass: 'text-amber-600',
	},
];

// Helpers
function adminFetch<T>(path: string, options?: Parameters<typeof $fetch>[1]) {
	return $fetch<T>(`${apiUrl}${path}`, { credentials: 'include', ...options });
}

function toastError(title: string) {
	toast.add({ title, color: 'error', icon: 'i-heroicons-x-circle' });
}

// Methods
async function loadTools() {
	isLoading.value = true;
	try {
		const response = await adminFetch<ToolsResponse>('/admin/tools');
		if (response.success) {
			allTools.value = response.data.tools;
			stats.value = response.data.stats;
		}
	} catch {
		toastError('Erro ao carregar tools');
	} finally {
		isLoading.value = false;
	}
}

async function toggleTool(toolName: string, enabled: boolean) {
	updatingTool.value = toolName;
	try {
		await adminFetch(`/admin/tools/${toolName}`, { method: 'PATCH', body: { enabled } });

		const tool = allTools.value.find((t) => t.name === toolName);
		if (tool) tool.enabled = enabled;

		if (stats.value) {
			stats.value.enabled = allTools.value.filter((t) => t.enabled).length;
			stats.value.disabled = allTools.value.filter((t) => !t.enabled).length;
		}

		toast.add({
			title: enabled ? 'Tool habilitada' : 'Tool desabilitada',
			description: `${toolName} ${enabled ? 'habilitada' : 'desabilitada'} para todos os usuários`,
			color: enabled ? 'success' : 'warning',
			icon: enabled ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle',
		});
	} catch {
		toastError('Erro ao atualizar tool');
	} finally {
		updatingTool.value = null;
	}
}

async function enableAllTools() {
	isEnablingAll.value = true;
	try {
		await adminFetch('/admin/tools/enable-all', { method: 'POST' });
		await loadTools();
		toast.add({ title: 'Todas as tools habilitadas', color: 'success', icon: 'i-heroicons-check-circle' });
	} catch {
		toastError('Erro ao habilitar todas as tools');
	} finally {
		isEnablingAll.value = false;
	}
}

async function disableAllTools() {
	isDisablingAll.value = true;
	try {
		await adminFetch('/admin/tools/disable-all', { method: 'POST' });
		await loadTools();
		toast.add({ title: 'Todas as tools desabilitadas', color: 'warning', icon: 'i-heroicons-x-circle' });
	} catch {
		toastError('Erro ao desabilitar todas as tools');
	} finally {
		isDisablingAll.value = false;
	}
}

// Lifecycle
onMounted(() => {
	loadTools();
});
</script>
