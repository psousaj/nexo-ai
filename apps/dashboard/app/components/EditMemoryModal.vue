<script setup lang="ts">
import type { MemoryItem } from '~/types/dashboard';

const props = defineProps<{
	isOpen: boolean;
	loading?: boolean;
	memory: MemoryItem | null;
}>();

const emit = defineEmits(['close', 'save']);

const form = ref({
	title: '',
	content: '',
});

// Update form when memory prop changes
watch(
	() => props.memory,
	(newMem) => {
		if (newMem) {
			form.value = {
				title: newMem.title,
				content: newMem.content,
			};
		}
	},
	{ immediate: true },
);

const handleClose = () => {
	if (props.loading) return;
	emit('close');
};

const _handleSave = () => {
	if (!form.value.title || !form.value.content) return;
	emit('save', { ...form.value });
};

// Handle ESC key
if (process.client) {
	const handleEsc = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && props.isOpen) handleClose();
	};

	onMounted(() => window.addEventListener('keydown', handleEsc));
	onUnmounted(() => window.removeEventListener('keydown', handleEsc));
}
</script>

<template>
	<Transition name="fade">
		<div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
			<!-- Backdrop -->
			<div class="absolute inset-0 bg-surface-950/40 backdrop-blur-sm" @click="handleClose"></div>

			<!-- Modal Content -->
			<div
				class="relative w-full max-w-lg bg-white dark:bg-surface-900 rounded-3xl shadow-2xl overflow-hidden border border-surface-200 dark:border-surface-800"
			>
				<div class="flex items-center justify-between p-6 border-b border-surface-100 dark:border-surface-800">
					<div class="flex items-center gap-2">
						<span
							class="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-[10px] font-black uppercase tracking-widest rounded-md"
							>Editar</span
						>
						<h3 class="text-xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic">Editar Memória</h3>
					</div>
					<button @click="handleClose" class="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors">
						<X class="w-5 h-5 text-surface-500" />
					</button>
				</div>

				<div class="p-6 space-y-6">
					<div>
						<label class="block text-xs font-black text-surface-400 uppercase tracking-widest mb-2">Título</label>
						<input
							v-model="form.title"
							type="text"
							placeholder="Ex: Minha nota importante"
							class="w-full px-4 py-3 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-2xl text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
						/>
					</div>

					<div>
						<label class="block text-xs font-black text-surface-400 uppercase tracking-widest mb-2">Conteúdo</label>
						<textarea
							v-model="form.content"
							rows="5"
							placeholder="Pode ser um texto, link ou sinopse..."
							class="w-full px-4 py-3 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-2xl text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all resize-none"
						></textarea>
					</div>
				</div>

				<div class="p-6 bg-surface-50 dark:bg-surface-900/50 flex items-center justify-end gap-3">
					<button
						@click="handleClose"
						class="px-5 py-2.5 text-sm font-bold text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"
					>
						Cancelar
					</button>
					<button
						@click="handleSave"
						:disabled="loading || !form.title || !form.content"
						class="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-black shadow-lg shadow-primary-600/20 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
					>
						<Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
						<Save v-else class="w-4 h-4" />
						Salvar Alterações
					</button>
				</div>
			</div>
		</div>
	</Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
