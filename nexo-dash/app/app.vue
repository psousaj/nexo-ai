<script setup lang="ts">
import { usePreferencesStore } from './stores/preferences';

const preferencesStore = usePreferencesStore();

onMounted(() => {
	preferencesStore.fetchPreferences();
});
</script>

<template>
	<div>
		<NuxtPage />
	</div>
</template>
