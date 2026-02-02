<script setup lang="ts">
import { Database } from 'lucide-vue-next';

definePageMeta({
	title: 'Minhas Memórias',
});
</script>

<template>
	<div class="space-y-6 animate-fade-in">
		<div class="flex items-center gap-4">
			<div class="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
				<Database class="w-6 h-6" />
			</div>
			<div>
				<h1 class="text-2xl font-black text-surface-900 dark:text-white uppercase tracking-tight italic">
					Minhas Memórias
				</h1>
				<p class="text-surface-500 dark:text-surface-400">
					Gerencie e visualize todo o seu histórico de conhecimento.
				</p>
			</div>
		</div>

		<div class="premium-card min-h-[400px] flex flex-col items-center justify-center text-center p-12">
			<div class="w-24 h-24 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center mb-6">
				<Database class="w-10 h-10 text-surface-400" />
			</div>
			<h3 class="text-xl font-bold text-surface-900 dark:text-white mb-2">
				Nenhuma memória encontrada
			</h3>
			<p class="text-surface-500 dark:text-surface-400 max-w-md mx-auto mb-8">
				Você ainda não salvou nenhuma memória. Use a extensão do navegador ou o bot do Discord para começar a salvar.
			</p>
			<button class="px-6 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all">
				Como salvar memórias?
			</button>
		</div>
	</div>
</template>
