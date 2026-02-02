<script setup lang="ts">
interface Props {
	title: string;
	loading?: boolean;
}

defineProps<Props>();
</script>

<template>
	<div class="premium-card flex flex-col gap-6">
		<div class="flex items-center justify-between">
			<h3 class="font-bold text-lg text-surface-900 dark:text-white">{{ title }}</h3>
			<div class="flex items-center gap-2">
				<slot name="actions" />
			</div>
		</div>

		<div class="relative flex-1 min-h-[300px] flex items-center justify-center">
			<div v-if="loading" class="animate-pulse flex flex-col items-center gap-4 w-full h-full justify-center">
				<div class="h-4 bg-surface-200 dark:bg-surface-800 rounded w-full"></div>
				<div class="h-64 bg-surface-100 dark:bg-surface-800/50 rounded w-full"></div>
			</div>
			<slot v-else />
		</div>
	</div>
</template>
