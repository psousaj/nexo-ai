<script setup lang="ts">
import type { ItemType } from '~/types/dashboard';

const props = defineProps<{
	isOpen: boolean;
	loading?: boolean;
}>();

const emit = defineEmits(['close', 'save']);

const form = ref({
	title: '',
	type: 'note' as ItemType,
	content: '',
});

const _types = [
	{ label: 'Nota', value: 'note' },
	{ label: 'Link', value: 'link' },
	{ label: 'Filme', value: 'movie' },
	{ label: 'Série', value: 'tv_show' },
	{ label: 'Vídeo', value: 'video' },
];

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
					<h3 class="text-xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic">Adicionar Nova Memória</h3>
					<button @click="handleClose" class="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors">
						<X class="w-5 h-5 text-surface-500" />
					</button>
				</div>

				<div class="p-6 space-y-6">
					<div>
						<label class="block text-xs font-black text-surface-400 uppercase tracking-widest mb-2">Tipo de Conteúdo</label>
						<div class="grid grid-cols-3 gap-2">
							<button
								v-for="t in types"
								:key="t.value"
								@click="form.type = t.value as ItemType"
								:class="[
									'px-3 py-2 rounded-xl text-xs font-bold transition-all border',
									form.type === t.value
										? 'bg-primary-50 border-primary-200 text-primary-600 dark:bg-primary-900/20 dark:border-primary-800 dark:text-primary-400'
										: 'bg-white border-surface-200 text-surface-600 dark:bg-surface-900 dark:border-surface-800 dark:text-surface-400 hover:border-surface-300',
								]"
							>
								{{ t.label }}
							</button>
						</div>
					</div>

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
						<label class="block text-xs font-black text-surface-400 uppercase tracking-widest mb-2">
							{{ form.type === 'link' ? 'URL' : 'Conteúdo' }}
						</label>
						<textarea
							v-model="form.content"
							:rows="form.type === 'link' ? 2 : 4"
							:placeholder="form.type === 'link' ? 'https://...' : 'Descreva sua memória...'"
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
						Salvar
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
