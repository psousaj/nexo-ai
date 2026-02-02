<script setup lang="ts">
import { AlertTriangle, Loader2 } from 'lucide-vue-next';

const props = defineProps<{
	isOpen: boolean;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	loading?: boolean;
	type?: 'danger' | 'warning' | 'info';
}>();

const emit = defineEmits(['close', 'confirm']);

const handleClose = () => {
	if (props.loading) return;
	emit('close');
};

const handleConfirm = () => {
	emit('confirm');
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
		<div v-if="isOpen" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
			<!-- Backdrop -->
			<div class="absolute inset-0 bg-surface-950/40 backdrop-blur-sm" @click="handleClose"></div>

			<!-- Modal Content -->
			<div
				class="relative w-full max-w-md bg-white dark:bg-surface-900 rounded-3xl shadow-2xl overflow-hidden border border-surface-200 dark:border-surface-800"
			>
				<div class="p-8 text-center">
					<div
						:class="[
							'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-transform hover:scale-110',
							type === 'danger'
								? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
								: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
						]"
					>
						<AlertTriangle class="w-8 h-8" />
					</div>

					<h3 class="text-2xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic mb-2">{{ title }}</h3>
					<p class="text-surface-500 dark:text-surface-400">{{ message }}</p>
				</div>

				<div class="p-6 bg-surface-50 dark:bg-surface-900/50 flex flex-col sm:flex-row gap-3">
					<button
						@click="handleClose"
						class="flex-1 px-5 py-3 text-sm font-bold text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"
					>
						{{ cancelText || 'Cancelar' }}
					</button>
					<button
						@click="handleConfirm"
						:disabled="loading"
						:class="[
							'flex-1 flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl text-sm font-black shadow-lg transition-all',
							type === 'danger'
								? 'bg-rose-600 shadow-rose-600/20 hover:bg-rose-700'
								: 'bg-primary-600 shadow-primary-600/20 hover:bg-primary-700',
						]"
					>
						<Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
						{{ confirmText || 'Confirmar' }}
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
