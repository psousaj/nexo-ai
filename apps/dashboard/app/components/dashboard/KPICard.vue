<script setup lang="ts">
import { computed } from 'vue';

interface Props {
	title: string;
	value: string | number;
	trend: number;
	icon: any;
	suffix?: string;
	loading?: boolean;
}

const props = defineProps<Props>();

const isPositive = computed(() => props.trend > 0);
const formattedTrend = computed(() => `${Math.abs(props.trend)}%`);
</script>

<template>
	<div class="premium-card group">
		<div v-if="loading" class="animate-pulse flex space-x-4">
			<div class="rounded-full bg-surface-200 dark:bg-surface-800 h-12 w-12" />
			<div class="flex-1 space-y-4 py-1">
				<div class="h-4 bg-surface-200 dark:bg-surface-800 rounded w-3/4" />
				<div class="space-y-2">
					<div class="h-4 bg-surface-200 dark:bg-surface-800 rounded" />
				</div>
			</div>
		</div>

		<div v-else class="flex flex-col gap-4">
			<div class="flex items-center justify-between">
				<div
					class="p-3 rounded-xl bg-primary-100/50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 group-hover:bg-primary-600 group-hover:text-white transition-colors duration-300"
				>
					<component :is="icon" class="w-6 h-6" />
				</div>

				<div
					:class="[
						'flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full',
						isPositive ? 'text-emerald-600 bg-emerald-100/50 dark:bg-emerald-900/20' : 'text-rose-600 bg-rose-100/50 dark:bg-rose-900/20',
					]"
				>
					<TrendingUp v-if="isPositive" class="w-3 h-3" />
					<TrendingDown v-else class="w-3 h-3" />
					{{ formattedTrend }}
				</div>
			</div>

			<div>
				<h3 class="text-sm font-medium text-surface-500 dark:text-surface-400 mb-1">
					{{ title }}
				</h3>
				<p class="text-2xl font-bold text-surface-900 dark:text-white flex items-baseline">
					{{ value }}
					<span v-if="suffix" class="ml-1 text-sm font-normal text-surface-500">{{ suffix }}</span>
				</p>
			</div>
		</div>
	</div>
</template>
