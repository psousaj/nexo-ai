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
			color="amber"
			variant="soft"
			icon="i-heroicons-exclamation-triangle"
			title="Atenção: Controle Global"
			description="Desabilitar uma tool impede todos os usuários de usá-la. Use com moderação."
		/>

		<!-- Stats -->
		<div v-if="stats" class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<UCard>
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Total</p>
						<p class="text-2xl font-bold">{{ stats.total }}</p>
					</div>
					<UIcon name="i-heroicons-cog-6-tooth" class="w-8 h-8 text-gray-400" />
				</div>
			</UCard>

			<UCard>
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Habilitadas</p>
						<p class="text-2xl font-bold text-green-600">{{ stats.enabled }}</p>
					</div>
					<UIcon name="i-heroicons-check-circle" class="w-8 h-8 text-green-400" />
				</div>
			</UCard>

			<UCard>
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Desabilitadas</p>
						<p class="text-2xl font-bold text-red-600">{{ stats.disabled }}</p>
					</div>
					<UIcon name="i-heroicons-x-circle" class="w-8 h-8 text-red-400" />
				</div>
			</UCard>

			<UCard>
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Sistema</p>
						<p class="text-2xl font-bold text-blue-600">{{ stats.system }}</p>
					</div>
					<UIcon name="i-heroicons-lock-closed" class="w-8 h-8 text-blue-400" />
				</div>
			</UCard>
		</div>

		<!-- Bulk Actions -->
		<div class="flex gap-3">
			<UButton
				color="green"
				variant="soft"
				icon="i-heroicons-check-circle"
				:loading="isEnablingAll"
				@click="enableAllTools"
			>
				Habilitar Todas
			</UButton>

			<UButton
				color="red"
				variant="soft"
				icon="i-heroicons-x-circle"
				:loading="isDisablingAll"
				@click="disableAllTools"
			>
				Desabilitar Todas
			</UButton>

			<UButton variant="ghost" icon="i-heroicons-arrow-path" :loading="isLoading" @click="loadTools">
				Recarregar
			</UButton>
		</div>

		<!-- System Tools (Read-only) -->
		<UCard>
			<template #header>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<UIcon name="i-heroicons-lock-closed" class="w-5 h-5 text-blue-600" />
						<h2 class="text-xl font-semibold">Tools de Sistema</h2>
					</div>
					<UBadge color="blue" variant="subtle">Sempre Habilitadas</UBadge>
				</div>
			</template>

			<div class="space-y-3">
				<div v-for="tool in systemTools" :key="tool.name" class="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
					<div class="flex items-center gap-3">
						<span class="text-2xl">{{ tool.icon }}</span>
						<div>
							<p class="font-medium">{{ tool.label }}</p>
							<p class="text-sm text-gray-600 dark:text-gray-400">{{ tool.description }}</p>
						</div>
					</div>
					<UToggle :model-value="true" disabled />
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
					<UBadge color="purple" variant="subtle">Plugáveis</UBadge>
				</div>
			</template>

			<div class="space-y-3">
				<div
					v-for="tool in userTools"
					:key="tool.name"
					class="flex items-center justify-between p-4 rounded-lg border"
					:class="tool.enabled ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'"
				>
					<div class="flex items-center gap-3">
						<span class="text-2xl">{{ tool.icon }}</span>
						<div>
							<p class="font-medium">{{ tool.label }}</p>
							<p class="text-sm text-gray-600 dark:text-gray-400">{{ tool.description }}</p>
						</div>
					</div>

					<UToggle
						:model-value="tool.enabled"
						:loading="updatingTool === tool.name"
						@update:model-value="toggleTool(tool.name, $event)"
					/>
				</div>
			</div>
		</UCard>
	</div>
</template>

<script setup lang="ts">
import type { ToolDefinition } from '~/types';

definePageMeta({
	middleware: ['auth', 'role'],
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

// Methods
async function loadTools() {
	isLoading.value = true;
	try {
		const response = await $fetch<ToolsResponse>(`${apiUrl}/api/admin/tools`, {
			credentials: 'include',
		});

		if (response.success) {
			allTools.value = response.data.tools;
			stats.value = response.data.stats;
		}
	} catch (error) {
		toast.add({
			title: 'Erro ao carregar tools',
			color: 'red',
			icon: 'i-heroicons-x-circle',
		});
	} finally {
		isLoading.value = false;
	}
}

async function toggleTool(toolName: string, enabled: boolean) {
	updatingTool.value = toolName;
	try {
		await $fetch(`${apiUrl}/api/admin/tools/${toolName}`, {
			method: 'PATCH',
			credentials: 'include',
			body: { enabled },
		});

		// Atualizar localmente
		const tool = allTools.value.find((t) => t.name === toolName);
		if (tool) {
			tool.enabled = enabled;
		}

		// Atualizar stats
		if (stats.value) {
			stats.value.enabled = allTools.value.filter((t) => t.enabled).length;
			stats.value.disabled = allTools.value.filter((t) => !t.enabled).length;
		}

		toast.add({
			title: enabled ? 'Tool habilitada' : 'Tool desabilitada',
			description: `${toolName} ${enabled ? 'habilitada' : 'desabilitada'} para todos os usuários`,
			color: enabled ? 'green' : 'orange',
			icon: enabled ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle',
		});
	} catch (error) {
		toast.add({
			title: 'Erro ao atualizar tool',
			color: 'red',
			icon: 'i-heroicons-x-circle',
		});
	} finally {
		updatingTool.value = null;
	}
}

async function enableAllTools() {
	isEnablingAll.value = true;
	try {
		await $fetch(`${apiUrl}/api/admin/tools/enable-all`, {
			method: 'POST',
			credentials: 'include',
		});

		await loadTools();

		toast.add({
			title: 'Todas as tools habilitadas',
			color: 'green',
			icon: 'i-heroicons-check-circle',
		});
	} catch (error) {
		toast.add({
			title: 'Erro ao habilitar todas as tools',
			color: 'red',
			icon: 'i-heroicons-x-circle',
		});
	} finally {
		isEnablingAll.value = false;
	}
}

async function disableAllTools() {
	isDisablingAll.value = true;
	try {
		await $fetch(`${apiUrl}/api/admin/tools/disable-all`, {
			method: 'POST',
			credentials: 'include',
		});

		await loadTools();

		toast.add({
			title: 'Todas as tools desabilitadas',
			color: 'orange',
			icon: 'i-heroicons-x-circle',
		});
	} catch (error) {
		toast.add({
			title: 'Erro ao desabilitar todas as tools',
			color: 'red',
			icon: 'i-heroicons-x-circle',
		});
	} finally {
		isDisablingAll.value = false;
	}
}

// Lifecycle
onMounted(() => {
	loadTools();
});
</script>
