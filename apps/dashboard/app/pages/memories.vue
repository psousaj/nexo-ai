<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { FileText, Image as ImageIcon, Layers, Link as LinkIcon, Type } from 'lucide-vue-next';
import { useDashboard } from '~/composables/useDashboard';
import type { MemoryItem } from '~/types/dashboard';

const dashboard = useDashboard();
const queryClient = useQueryClient();
const searchQuery = ref('');

const { data: memories, isLoading } = useQuery({
	queryKey: ['memories', searchQuery],
	queryFn: () => dashboard.getMemories(searchQuery.value),
});

const _iconMap: Record<string, any> = {
	movie: Layers,
	tv_show: Layers,
	text: Type,
	link: LinkIcon,
	image: ImageIcon,
	file: FileText,
	note: Type,
	video: Layers,
	audio: ImageIcon,
};

// Modals State
const isAddModalOpen = ref(false);
const isEditModalOpen = ref(false);
const isConfirmModalOpen = ref(false);
const selectedMemory = ref<MemoryItem | null>(null);
const isSubmitting = ref(false);

// Mutations
const createMutation = useMutation({
	mutationFn: (payload: any) => dashboard.createMemory(payload),
	onSuccess: () => {
		queryClient.invalidateQueries({ queryKey: ['memories'] });
		isAddModalOpen.value = false;
	},
});

const updateMutation = useMutation({
	mutationFn: ({ id, payload }: { id: string | number; payload: any }) => dashboard.updateMemory(id, payload),
	onSuccess: () => {
		queryClient.invalidateQueries({ queryKey: ['memories'] });
		isEditModalOpen.value = false;
	},
});

const deleteMutation = useMutation({
	mutationFn: (id: string | number) => dashboard.deleteMemory(id),
	onSuccess: () => {
		queryClient.invalidateQueries({ queryKey: ['memories'] });
		isConfirmModalOpen.value = false;
	},
});

const _handleAdd = async (payload: any) => {
	isSubmitting.value = true;
	try {
		await createMutation.mutateAsync(payload);
	} finally {
		isSubmitting.value = false;
	}
};

const _handleEdit = (memory: MemoryItem) => {
	selectedMemory.value = memory;
	isEditModalOpen.value = true;
};

const _handleUpdate = async (payload: any) => {
	if (!selectedMemory.value) return;
	isSubmitting.value = true;
	try {
		await updateMutation.mutateAsync({ id: selectedMemory.value.id, payload });
	} finally {
		isSubmitting.value = false;
	}
};

const _handleDeleteClick = (memory: MemoryItem) => {
	selectedMemory.value = memory;
	isConfirmModalOpen.value = true;
};

const _handleConfirmDelete = async () => {
	if (!selectedMemory.value) return;
	isSubmitting.value = true;
	try {
		await deleteMutation.mutateAsync(selectedMemory.value.id);
	} finally {
		isSubmitting.value = false;
	}
};

const _filteredMemories = computed(() => memories.value || []);
</script>

<template>
	<div class="space-y-8 animate-fade-in">
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
			<div>
				<h2 class="text-3xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic">Minhas Memórias</h2>
				<p class="text-surface-500 dark:text-surface-400 mt-1">Sua segunda memória digital organizada automaticamente.</p>
			</div>

			<div class="flex items-center gap-3">
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
					<input
						v-model="searchQuery"
						type="text"
						placeholder="Buscar..."
						class="pl-10 pr-4 py-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 transition-all w-48 md:w-72 outline-none"
					/>
				</div>
				<button
					@click="isAddModalOpen = true"
					class="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary-600/20 hover:scale-[1.02] active:scale-95 transition-all"
				>
					<Plus class="w-4 h-4" /> Nova
				</button>
			</div>
		</div>

		<!-- Categories -->
		<div class="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
			<button
				class="px-5 py-2 bg-primary-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary-600/20 whitespace-nowrap"
			>
				Todas
			</button>
			<button
				v-for="cat in ['Filmes', 'Dev', 'Receitas', 'Pessoal']"
				:key="cat"
				class="px-5 py-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl text-xs font-bold text-surface-500 hover:border-primary-500 transition-all whitespace-nowrap"
			>
				{{ cat }}
			</button>
		</div>

		<div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse">
			<div v-for="i in 3" :key="i" class="h-64 bg-surface-100 dark:bg-surface-800 rounded-2xl"></div>
		</div>

		<!-- Memories Grid -->
		<div v-else-if="filteredMemories.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
			<div
				v-for="memory in filteredMemories"
				:key="memory.id"
				class="premium-card group hover:scale-[1.02] transition-all flex flex-col gap-4"
			>
				<div class="flex items-start justify-between">
					<div
						class="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-colors duration-300 shadow-sm"
					>
						<component :is="iconMap[memory.type] || FileText" class="w-6 h-6" />
					</div>
					<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
						<button
							@click="handleEdit(memory)"
							class="p-2 text-surface-400 hover:text-primary-600 bg-surface-50 dark:bg-surface-800 rounded-lg transition-colors"
						>
							<Edit3 class="w-4 h-4" />
						</button>
						<button
							@click="handleDeleteClick(memory)"
							class="p-2 text-surface-400 hover:text-rose-600 bg-surface-50 dark:bg-surface-800 rounded-lg transition-colors"
						>
							<Trash2 class="w-4 h-4" />
						</button>
					</div>
				</div>

				<div>
					<h3 class="text-xl font-black text-surface-900 dark:text-white leading-tight mb-2 uppercase tracking-tighter">
						{{ memory.title }}
					</h3>
					<p class="text-sm text-surface-500 dark:text-surface-400 line-clamp-3 italic">"{{ memory.content }}"</p>
				</div>

				<div class="mt-auto pt-4 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Tag class="w-3.5 h-3.5 text-primary-500" />
						<span class="text-[10px] font-black text-surface-400 uppercase tracking-widest">{{ memory.category }}</span>
					</div>
					<div class="flex items-center gap-1.5 text-[10px] font-bold text-surface-400">
						<Calendar class="w-3.5 h-3.5" />
						{{ new Date(memory.createdAt).toLocaleDateString() }}
					</div>
				</div>
			</div>
		</div>

		<!-- Empty State -->
		<div v-else class="flex flex-col items-center justify-center py-20 text-center">
			<div class="w-20 h-20 bg-surface-100 dark:bg-surface-800 rounded-3xl flex items-center justify-center text-surface-400 mb-6">
				<Search class="w-10 h-10" />
			</div>
			<h3 class="text-xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic">Nenhuma memória encontrada</h3>
			<p class="text-surface-500 dark:text-surface-400 mt-2 max-w-xs">Tente ajustar sua busca ou adicione uma nova memória manualmente.</p>
		</div>

		<!-- Modals -->
		<AddMemoryModal :is-open="isAddModalOpen" :loading="isSubmitting" @close="isAddModalOpen = false" @save="handleAdd" />

		<EditMemoryModal
			:is-open="isEditModalOpen"
			:loading="isSubmitting"
			:memory="selectedMemory"
			@close="isEditModalOpen = false"
			@save="handleUpdate"
		/>

		<ConfirmModal
			:is-open="isConfirmModalOpen"
			:loading="isSubmitting"
			title="Excluir Memória?"
			message="Esta ação é irreversível e removerá permanentemente esta memória da sua base."
			type="danger"
			confirm-text="Sim, Excluir"
			@close="isConfirmModalOpen = false"
			@confirm="handleConfirmDelete"
		/>
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
