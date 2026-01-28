<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { dashboardService } from '../services/dashboard.service';
import { AlertCircle, Search, Filter as _F, ExternalLink, Clock, CheckCircle2 } from 'lucide-vue-next';

const { data: errorReports, isLoading } = useQuery({
	queryKey: ['admin-errors'],
	queryFn: () => dashboardService.getErrors(),
});
</script>

<template>
	<div class="space-y-8 animate-fade-in">
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
			<div>
				<h2 class="text-3xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic">Relatório de Erros</h2>
				<p class="text-surface-500 dark:text-surface-400 mt-1">Monitore e resolva falhas técnicas em tempo real.</p>
			</div>

			<div class="flex items-center gap-3">
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
					<input
						type="text"
						placeholder="Buscar erros..."
						class="pl-10 pr-4 py-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 transition-all w-64"
					/>
				</div>
			</div>
		</div>

		<div v-if="isLoading" class="grid grid-cols-1 gap-6 animate-pulse">
			<div v-for="i in 3" :key="i" class="h-24 bg-surface-100 dark:bg-surface-800 rounded-2xl"></div>
		</div>

		<template v-else>
			<!-- Stats Bar -->
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
				<div class="premium-card !p-4 flex items-center gap-4">
					<div class="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center">
						<AlertCircle class="w-6 h-6" />
					</div>
					<div>
						<p class="text-2xl font-black text-surface-900 dark:text-white">3</p>
						<p class="text-xs font-bold text-surface-500 uppercase">Críticos</p>
					</div>
				</div>
				<div class="premium-card !p-4 flex items-center gap-4">
					<div class="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
						<Clock class="w-6 h-6" />
					</div>
					<div>
						<p class="text-2xl font-black text-surface-900 dark:text-white">1</p>
						<p class="text-xs font-bold text-surface-500 uppercase">Pendentes</p>
					</div>
				</div>
				<div class="premium-card !p-4 flex items-center gap-4">
					<div class="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
						<CheckCircle2 class="w-6 h-6" />
					</div>
					<div>
						<p class="text-2xl font-black text-surface-900 dark:text-white">2</p>
						<p class="text-xs font-bold text-surface-500 uppercase">Resolvidos</p>
					</div>
				</div>
			</div>

			<!-- Error List -->
			<div class="premium-card overflow-hidden !p-0">
				<div class="overflow-x-auto">
					<table class="w-full text-left">
						<thead class="bg-surface-50 dark:bg-surface-900/50 border-b border-surface-200 dark:border-surface-800">
							<tr>
								<th class="px-6 py-4 text-xs font-black text-surface-500 uppercase tracking-widest">ID / Status</th>
								<th class="px-6 py-4 text-xs font-black text-surface-500 uppercase tracking-widest">Serviço</th>
								<th class="px-6 py-4 text-xs font-black text-surface-500 uppercase tracking-widest">Mensagem</th>
								<th class="px-6 py-4 text-xs font-black text-surface-500 uppercase tracking-widest">Severidade</th>
								<th class="px-6 py-4 text-xs font-black text-surface-500 uppercase tracking-widest text-right">Ação</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-surface-100 dark:divide-surface-800">
							<tr
								v-for="error in errorReports"
								:key="error.id"
								class="group hover:bg-surface-50 dark:hover:bg-surface-900/50 transition-colors"
							>
								<td class="px-6 py-4">
									<div class="flex flex-col">
										<span class="font-bold text-surface-900 dark:text-white">{{ error.id }}</span>
										<span
											:class="[
												'text-[10px] uppercase font-black px-1.5 py-0.5 rounded-md w-fit mt-1',
												error.status === 'pending'
													? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
													: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
											]"
										>
											{{ error.status }}
										</span>
									</div>
								</td>
								<td class="px-6 py-4">
									<span
										class="px-3 py-1 bg-surface-100 dark:bg-surface-800 rounded-lg text-sm font-medium border border-surface-200 dark:border-surface-700"
									>
										{{ error.service }}
									</span>
								</td>
								<td class="px-6 py-4">
									<p class="text-sm font-medium text-surface-900 dark:text-white line-clamp-1">{{ error.message }}</p>
									<p class="text-[10px] text-surface-500 font-bold uppercase mt-1">{{ new Date(error.timestamp).toLocaleString() }}</p>
								</td>
								<td class="px-6 py-4">
									<div class="flex items-center gap-2">
										<div
											:class="[
												'w-2 h-2 rounded-full',
												error.severity === 'critical'
													? 'bg-rose-600 animate-pulse'
													: error.severity === 'high'
														? 'bg-rose-500'
														: error.severity === 'medium'
															? 'bg-amber-500'
															: 'bg-blue-500',
											]"
										></div>
										<span class="text-xs font-bold capitalize">{{ error.severity }}</span>
									</div>
								</td>
								<td class="px-6 py-4 text-right">
									<button
										class="p-2 text-surface-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-all"
									>
										<ExternalLink class="w-5 h-5" />
									</button>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</template>
	</div>
</template>
