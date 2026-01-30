<script setup lang="ts">
import { ref as _r, computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useAuthStore } from '../store/auth';
import { dashboardService } from '../services/dashboard.service';

import KPICard from '../components/KPICard.vue';
import ChartCard from '../components/ChartCard.vue';
import { Users, Database, MessageSquare, Activity, Calendar as _C, Download, Filter } from 'lucide-vue-next';
import { useAbility } from '@casl/vue';

// Chart.js imports
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Title,
	Tooltip,
	Legend,
	ArcElement,
	Filler,
} from 'chart.js';
import { Line, Doughnut } from 'vue-chartjs';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler);

const authStore = useAuthStore();
const { can } = useAbility();

// Fetch Analytics via Service
const { data: analytics, isLoading } = useQuery({
	queryKey: ['analytics'],
	queryFn: () => dashboardService.getAnalytics(),
	staleTime: 5 * 60 * 1000,
});

const iconMap: Record<string, any> = {
	Users,
	Database,
	MessageSquare,
	Activity,
};

// Chart Data
const lineChartData = computed(() => {
	const trends = analytics.value?.trends;
	if (!trends) return { labels: [], datasets: [] };
	return {
		labels: trends.labels,
		datasets: trends.datasets.map((ds) => ({
			label: ds.label,
			data: ds.data,
			borderColor: ds.color,
			backgroundColor: `${ds.color}20`,
			fill: true,
			tension: 0.4,
			pointRadius: 4,
			pointHoverRadius: 6,
		})),
	};
});

const lineChartOptions = {
	responsive: true,
	maintainAspectRatio: false,
	plugins: {
		legend: {
			position: 'top' as const,
			labels: {
				usePointStyle: true,
				padding: 20,
				font: { family: 'Inter' },
			},
		},
		tooltip: {
			padding: 12,
			backgroundColor: 'rgba(15, 23, 42, 0.9)',
			titleFont: { size: 14, family: 'Inter' },
			bodyFont: { size: 13, family: 'Inter' },
		},
	},
	scales: {
		y: {
			beginAtZero: true,
			grid: {
				color: 'rgba(148, 163, 184, 0.1)',
			},
		},
		x: {
			grid: {
				display: false,
			},
		},
	},
};

const doughnutData = computed(() => {
	const breakdown = analytics.value?.breakdown;
	if (!breakdown) return { labels: [], datasets: [] };
	return {
		labels: breakdown.labels,
		datasets: [
			{
				data: breakdown.data,
				backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'],
				borderWidth: 0,
				hoverOffset: 10,
			},
		],
	};
});

const doughnutOptions = {
	responsive: true,
	maintainAspectRatio: false,
	cutout: '70%',
	plugins: {
		legend: {
			position: 'bottom' as const,
			labels: {
				usePointStyle: true,
				padding: 20,
				font: { family: 'Inter' },
			},
		},
	},
};

// Filtered KPIs based on role/CASL
const displayKPIs = computed(() => {
	if (!analytics.value?.kpis) return [];
	// Admins see all. Users see only 2 select ones as example
	return can('manage', 'AdminPanel')
		? analytics.value.kpis
		: analytics.value.kpis.filter((k) => k.title === 'Memórias Salvas' || k.title === 'Mensagens Processadas');
});
</script>

<template>
	<div class="space-y-8 animate-fade-in">
		<!-- Welcome Header -->
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
			<div>
				<h2 class="text-3xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic">
					Olá, {{ authStore.user?.name?.split(' ')[0] || 'Usuário' }}! 👋
				</h2>
				<p class="text-surface-500 dark:text-surface-400 mt-1">
					{{
						can('manage', 'AdminPanel')
							? 'Aqui está o resumo operacional do Nexo AI.'
							: 'Sua inteligência artificial está pronta para organizar seu dia.'
					}}
				</p>
			</div>

			<div class="flex items-center gap-3">
				<button
					v-if="can('manage', 'AdminPanel')"
					class="flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl text-sm font-bold hover:bg-surface-50 transition-colors"
				>
					<Filter class="w-4 h-4" />
					Filtrar
				</button>
				<button
					class="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 active:scale-95"
				>
					<Download class="w-4 h-4" />
					Exportar PDF
				</button>
			</div>
		</div>

		<!-- KPI Grid -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
			<KPICard
				v-for="kpi in displayKPIs"
				:key="kpi.title"
				:title="kpi.title"
				:value="kpi.value"
				:trend="kpi.trend"
				:icon="iconMap[kpi.icon]"
				:loading="isLoading"
			/>
		</div>

		<!-- Charts Row -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Main Growth Chart - Admin/Strategic View -->
			<ChartCard v-if="can('manage', 'AdminPanel')" title="Crescimento da Plataforma" class="lg:col-span-2" :loading="isLoading">
				<template #actions>
					<div class="flex items-center gap-1 bg-surface-100 dark:bg-surface-800 p-1 rounded-lg">
						<button class="px-3 py-1 text-xs font-bold rounded-md bg-white dark:bg-surface-700 shadow-sm">7D</button>
						<button class="px-3 py-1 text-xs font-bold rounded-md text-surface-500 hover:text-surface-900">30D</button>
						<button class="px-3 py-1 text-xs font-bold rounded-md text-surface-500 hover:text-surface-900 text-transparent">365D</button>
					</div>
				</template>
				<Line :data="lineChartData" :options="lineChartOptions" />
			</ChartCard>

			<!-- Breakdown Chart - Domain Specific View -->
			<ChartCard title="Distribuição de Memórias" :class="{ 'lg:col-span-3': !can('manage', 'AdminPanel') }" :loading="isLoading">
				<Doughnut :data="doughnutData" :options="doughnutOptions" />
			</ChartCard>
		</div>

		<!-- User's Recent Activity (Customized based on who is viewing) -->
		<div class="premium-card">
			<div class="flex items-center justify-between mb-6">
				<h3 class="font-black text-lg text-surface-900 dark:text-white uppercase tracking-tight italic">
					{{ can('manage', 'AdminPanel') ? 'Tráfego Recente Anônimo' : 'Minhas Atividades Recentes' }}
				</h3>
				<router-link to="/memories" class="text-xs font-black text-primary-600 hover:underline uppercase tracking-widest"
					>Ver tudo</router-link
				>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full text-left">
					<thead>
						<tr
							class="text-surface-400 text-[10px] uppercase font-black tracking-widest border-b border-surface-100 dark:border-surface-800"
						>
							<th class="pb-4 px-4">{{ can('manage', 'AdminPanel') ? 'User ID' : 'Origem' }}</th>
							<th class="pb-4 px-4">Tipo</th>
							<th class="pb-4 px-4">Conteúdo</th>
							<th class="pb-4 px-4 text-right">Data</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-surface-100 dark:divide-surface-800">
						<tr
							v-for="item in analytics?.recentItems || []"
							:key="item.id"
							class="group hover:bg-surface-50 dark:hover:bg-surface-900/50 transition-colors"
						>
							<td class="py-4 px-4">
								<div class="flex items-center gap-3">
									<div
										class="w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center font-black text-[10px] text-surface-500 italic"
									>
										{{ can('manage', 'AdminPanel') ? 'U#' + item.id : item.platform }}
									</div>
									<span v-if="can('manage', 'AdminPanel')" class="font-bold text-xs text-surface-900 dark:text-white font-mono">{{
										'0x' + item.id + '...f3'
									}}</span>
								</div>
							</td>
							<td class="py-4 px-4">
								<span
									:class="[
										'px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter',
										item.type === 'link'
											? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30'
											: item.type === 'text'
												? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30'
												: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
									]"
								>
									{{ item.type }}
								</span>
							</td>
							<td class="py-4 px-4 text-sm font-medium text-surface-500 dark:text-surface-400 max-w-xs truncate italic">
								"{{ item.content }}"
							</td>
							<td class="py-4 px-4 text-right text-[10px] font-bold text-surface-400 uppercase tracking-tighter">
								{{ item.createdAt }}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</template>

<style scoped>
.animate-fade-in {
	animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(10px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
</style>
