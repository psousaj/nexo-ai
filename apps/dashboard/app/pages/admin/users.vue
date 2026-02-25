<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { useDashboard } from '~/composables/useDashboard';

definePageMeta({
	middleware: ['role'],
	layout: 'default',
});

interface UserAccount {
	id: string;
	provider: 'telegram' | 'whatsapp' | 'discord';
	externalId: string;
	createdAt: string;
}

interface User {
	id: string;
	name: string | null;
	email: string | null;
	assistantName: string | null;
	timeoutUntil: string | null;
	createdAt: string;
	updatedAt: string;
	accounts: UserAccount[];
	isActive: boolean;
}

interface UsersResponse {
	success: boolean;
	data: User[];
}

const dashboard = useDashboard();
const toast = useToast();
const queryClient = useQueryClient();

const config = useRuntimeConfig();

// Fetch users
const { data: users, isLoading } = useQuery<UsersResponse>({
	queryKey: ['admin-users'],
	queryFn: async () => {
		const response = await $fetch<UsersResponse>('/api/admin/users', {
			baseURL: config.public.apiUrl,
			credentials: 'include',
		});
		return response;
	},
});

// Computed stats
const stats = computed(() => {
	if (!users.value?.data) return { total: 0, active: 0, telegram: 0, whatsapp: 0, discord: 0 };

	const data = users.value.data;
	return {
		total: data.length,
		active: data.filter((u) => u.isActive).length,
		telegram: data.filter((u) => u.accounts?.some((a) => a.provider === 'telegram')).length,
		whatsapp: data.filter((u) => u.accounts?.some((a) => a.provider === 'whatsapp')).length,
		discord: data.filter((u) => u.accounts?.some((a) => a.provider === 'discord')).length,
	};
});

const columns: any = [
	{ key: 'name', label: 'Nome' },
	{ key: 'email', label: 'Email' },
	{ key: 'accounts', label: 'Contas' },
	{ key: 'createdAt', label: 'Criado em' },
	{ key: 'actions', label: 'Ações' },
];

function formatDate(date: string) {
	return new Date(date).toLocaleDateString('pt-BR', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	});
}

function getProviderIcon(provider: string) {
	const icons: Record<string, string> = {
		telegram: 'i-simple-icons-telegram',
		whatsapp: 'i-simple-icons-whatsapp',
		discord: 'i-simple-icons-discord',
	};
	return icons[provider] || 'i-heroicons-user';
}

function getProviderColor(provider: string): 'primary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' {
	const colors: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'> = {
		telegram: 'info',
		whatsapp: 'success',
		discord: 'primary',
	};
	return colors[provider] || 'neutral';
}
</script>

<template>
	<div class="space-y-6">
		<!-- Header -->
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
			<div>
				<h2 class="text-3xl font-black text-gray-900 dark:text-white">
					Gerenciar Usuários
				</h2>
				<p class="text-gray-600 dark:text-gray-400 mt-1">
					Lista de todos os usuários do sistema
				</p>
			</div>
		</div>

		<!-- Stats Cards -->
		<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
			<UCard>
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Total</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.total }}</p>
					</div>
					<UIcon name="i-heroicons-users" class="w-8 h-8 text-gray-400" />
				</div>
			</UCard>

			<UCard>
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Ativos</p>
						<p class="text-2xl font-bold text-green-600">{{ stats.active }}</p>
					</div>
					<UIcon name="i-heroicons-check-circle" class="w-8 h-8 text-green-400" />
				</div>
			</UCard>

			<UCard>
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Telegram</p>
						<p class="text-2xl font-bold text-blue-600">{{ stats.telegram }}</p>
					</div>
					<UIcon name="i-simple-icons-telegram" class="w-8 h-8 text-blue-400" />
				</div>
			</UCard>

			<UCard>
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">WhatsApp</p>
						<p class="text-2xl font-bold text-green-600">{{ stats.whatsapp }}</p>
					</div>
					<UIcon name="i-simple-icons-whatsapp" class="w-8 h-8 text-green-400" />
				</div>
			</UCard>

			<UCard>
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Discord</p>
						<p class="text-2xl font-bold text-purple-600">{{ stats.discord }}</p>
					</div>
					<UIcon name="i-simple-icons-discord" class="w-8 h-8 text-purple-400" />
				</div>
			</UCard>
		</div>

		<!-- Users Table -->
		<UCard>
			<template #header>
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-semibold">Usuários</h3>
					<UButton
						variant="ghost"
						icon="i-heroicons-arrow-path"
						:loading="isLoading"
						@click="() => queryClient.invalidateQueries({ queryKey: ['admin-users'] })"
					>
						Recarregar
					</UButton>
				</div>
			</template>

			<div v-if="isLoading" class="space-y-4">
				<USkeleton v-for="i in 5" :key="i" class="h-16" />
			</div>

			<div v-else-if="!users?.data?.length" class="text-center py-12">
				<UIcon name="i-heroicons-users" class="w-16 h-16 mx-auto text-gray-400 mb-4" />
				<p class="text-gray-600 dark:text-gray-400">Nenhum usuário encontrado</p>
			</div>

			<!-- @ts-ignore -->
			<UTable
				v-else
				:columns="columns"
				:rows="users.data"
				class="w-full"
			>
				<!-- @ts-ignore -->
				<template #name-data="{ row }">
					<div class="flex items-center gap-3">
						<UAvatar
							:alt="(row as unknown as User).name || 'User'"
							size="sm"
						/>
						<div>
							<p class="font-medium">{{ (row as unknown as User).name || 'Sem nome' }}</p>
							<p class="text-xs text-gray-500">ID: {{ (row as unknown as User).id }}</p>
						</div>
					</div>
				</template>

				<!-- @ts-ignore -->
				<template #email-data="{ row }">
					<span class="text-sm">{{ (row as unknown as User).email || '-' }}</span>
				</template>

				<!-- @ts-ignore -->
				<template #accounts-data="{ row }">
					<div class="flex gap-1">
						<UBadge
							v-for="account in (row as unknown as User).accounts"
							:key="account.id"
							:color="getProviderColor(account.provider)"
							variant="subtle"
							size="xs"
						>
							<UIcon :name="getProviderIcon(account.provider)" class="w-3 h-3 mr-1" />
							{{ account.provider }}
						</UBadge>
						<span v-if="!(row as unknown as User).accounts?.length" class="text-xs text-gray-500">Nenhuma</span>
					</div>
				</template>

				<!-- @ts-ignore -->
				<template #createdAt-data="{ row }">
					<span class="text-sm text-gray-600">{{ formatDate((row as unknown as User).createdAt) }}</span>
				</template>

				<!-- @ts-ignore -->
				<template #actions-data="{ row }">
					<div class="flex gap-2">
						<UButton
							icon="i-heroicons-eye"
							size="xs"
							color="neutral"
							variant="ghost"
							:to="`/admin/users/${(row as unknown as User).id}`"
						/>
						<UButton
							icon="i-heroicons-trash"
							size="xs"
							color="error"
							variant="ghost"
							@click="() => {
								// TODO: Implement delete
								toast.add({
									title: 'Não implementado',
									description: 'Funcionalidade em desenvolvimento',
									color: 'warning',
								});
							}"
						/>
					</div>
				</template>
			</UTable>
		</UCard>
	</div>
</template>
