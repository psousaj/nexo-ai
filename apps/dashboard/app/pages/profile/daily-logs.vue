<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { api } from '~/utils/api';
import { useAuthStore } from '~/stores/auth';
import { Calendar, Search, Plus, Save, BookOpen, FileText, ChevronLeft, ChevronRight } from 'lucide-vue-next';

definePageMeta({
	middleware: ['auth'],
});

const auth = useAuth();

// State
const selectedDate = ref(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
const logContent = ref('');
const isEditing = ref(false);

// Fetch daily logs
const { data: logs, isLoading, refetch } = useQuery({
	queryKey: ['daily-logs', auth.data?.user?.id],
	queryFn: async () => {
		const response = await api.get('/api/agent/daily-logs');
		return response.data;
	},
	enabled: computed(() => !!auth.data?.user?.id),
});

// Load selected log content
function loadLog(date: string) {
	const log = logs.value?.find((l: any) => l.logDate === date);
	if (log) {
		logContent.value = log.content;
	} else {
		logContent.value = '';
	}
	selectedDate.value = date;
	isEditing.value = false;
}

// Save log
async function saveLog() {
	try {
		await api.post('/api/agent/daily-logs', {
			date: selectedDate.value,
			content: logContent.value,
		});
		await refetch();
		isEditing.value = false;
	} catch (error) {
		console.error('Failed to save log:', error);
	}
}

// Navigate dates
function navigateDate(direction: 'prev' | 'next') {
	const date = new Date(selectedDate.value);
	if (direction === 'prev') {
		date.setDate(date.getDate() - 1);
	} else {
		date.setDate(date.getDate() + 1);
	}
	selectedDate.value = date.toISOString().split('T')[0];
	loadLog(selectedDate.value);
}

// Format date for display
function formatDisplayDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Get logs sorted by date (newest first)
const sortedLogs = computed(() => {
	if (!logs.value) return [];
	return [...logs.value].sort((a: any, b: any) => b.logDate.localeCompare(a.logDate));
});
</script>

<template>
	<div class="space-y-8 animate-fade-in">
		<!-- Header -->
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
			<div>
				<div class="flex items-center gap-2 text-primary-500 font-bold text-xs uppercase tracking-widest mb-1">
					<BookOpen class="w-3.5 h-3.5" /> Diário do Agente
				</div>
				<h2 class="text-3xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic">
					Daily Logs
				</h2>
				<p class="text-surface-500 dark:text-surface-400 mt-1">
					Registros diários do heartbeat e atividades do assistente (OpenClaw pattern).
				</p>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
			<!-- Sidebar: Calendar List -->
			<div class="lg:col-span-1">
				<div class="premium-card p-4 space-y-4">
					<h3 class="font-black text-surface-900 dark:text-white text-sm flex items-center gap-2">
						<Calendar class="w-4 h-4" />
						Histórico
					</h3>

					<div v-if="isLoading" class="space-y-2">
						<div v-for="i in 5" :key="i" class="h-8 bg-surface-100 dark:bg-surface-800 rounded-lg animate-pulse"></div>
					</div>

					<div v-else-if="sortedLogs.length === 0" class="text-center py-8">
						<FileText class="w-8 h-8 text-surface-300 dark:text-surface-600 mx-auto mb-2" />
						<p class="text-xs text-surface-500">Nenhum registro</p>
					</div>

					<div v-else class="space-y-1 max-h-[400px] overflow-y-auto">
						<button
							v-for="log in sortedLogs"
							:key="log.id"
							@click="loadLog(log.logDate)"
							:class="[
								'w-full text-left p-3 rounded-lg transition-all text-left',
								selectedDate === log.logDate
									? 'bg-primary-500 text-white'
									: 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700',
							]"
						>
							<p class="font-black text-xs">{{ formatDisplayDate(log.logDate) }}</p>
							<p class="text-[10px] opacity-80 mt-0.5">
								{{ log.content.substring(0, 50) }}{{ log.content.length > 50 ? '...' : '' }}
							</p>
						</button>
					</div>
				</div>
			</div>

			<!-- Main: Log Editor -->
			<div class="lg:col-span-3">
				<div class="premium-card p-6">
					<!-- Date Navigator -->
					<div class="flex items-center justify-between mb-6">
						<div class="flex items-center gap-3">
							<button
								@click="navigateDate('prev')"
								class="p-2 bg-surface-100 dark:bg-surface-800 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
							>
								<ChevronLeft class="w-4 h-4" />
							</button>
							<div>
								<h3 class="font-black text-surface-900 dark:text-white text-lg">
									{{ formatDisplayDate(selectedDate) }}
								</h3>
								<p class="text-xs text-surface-500 font-mono">{{ selectedDate }}</p>
							</div>
							<button
								@click="navigateDate('next')"
								class="p-2 bg-surface-100 dark:bg-surface-800 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
							>
								<ChevronRight class="w-4 h-4" />
							</button>
						</div>

						<div class="flex items-center gap-2">
							<button
								v-if="!isEditing"
								@click="isEditing = true"
								class="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg font-bold text-xs hover:bg-primary-600 transition-colors"
							>
								<Plus class="w-3.5 h-3.5" />
								Editar
							</button>
							<button
								v-if="isEditing"
								@click="saveLog"
								class="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg font-bold text-xs hover:bg-emerald-600 transition-colors"
							>
								<Save class="w-3.5 h-3.5" />
								Salvar
							</button>
							<button
								v-if="isEditing"
								@click="isEditing = false; loadLog(selectedDate)"
								class="px-4 py-2 bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-lg font-bold text-xs hover:bg-surface-300 dark:hover:bg-surface-600 transition-colors"
							>
								Cancelar
							</button>
						</div>
					</div>

					<!-- Log Content -->
					<div class="space-y-4">
						<div v-if="!isEditing && !logContent" class="text-center py-12">
							<FileText class="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-4" />
							<p class="text-surface-500 dark:text-surface-400 font-medium">
								Nenhum registro para esta data
							</p>
							<button
								@click="isEditing = true"
								class="mt-4 px-6 py-2 bg-primary-500 text-white rounded-lg font-bold text-sm hover:bg-primary-600 transition-colors"
							>
								Criar Registro
							</button>
						</div>

						<div v-else class="space-y-4">
							<textarea
								v-model="logContent"
								:disabled="!isEditing"
								:readonly="!isEditing"
								rows="20"
								placeholder="Escreva o registro do diário para esta data...
Exemplo:
- Atividades principais realizadas
- Interações interessantes com usuários
- Problemas ou desafios encontrados
- Ideias para melhorias futuras"
								class="w-full p-4 bg-surface-50 dark:bg-surface-900 border-2 rounded-xl focus:border-primary-500 focus:ring-0 text-surface-900 dark:text-white font-mono text-sm resize-none"
								:class="{
									'border-surface-200 dark:border-surface-800': !isEditing,
									'border-primary-500': isEditing,
								}"
							></textarea>

							<!-- Word count -->
							<div class="flex items-center justify-between text-xs text-surface-500">
								<span>{{ logContent.split(/\s+/).filter(w => w.length > 0).length }} palavras</span>
								<span>{{ logContent.split('\n').length }} linhas</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Info Box -->
				<div class="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
					<p class="text-xs text-purple-800 dark:text-purple-200 flex items-start gap-2">
						<span class="font-bold">💡 Sobre Daily Logs:</span>
						<span>Os diários são registros automáticos ou manuais das atividades do agente, úteis para debugging e análise de comportamento ao longo do tempo.</span>
					</p>
				</div>
			</div>
		</div>
	</div>
</template>
