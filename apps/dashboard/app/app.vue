<script setup lang="ts">
import { usePreferencesStore } from './stores/preferences';

const preferencesStore = usePreferencesStore();

onMounted(() => {
	// Inicializa o tema do localStorage após hydration
	preferencesStore.initializeTheme();
	// Busca preferências do backend
	preferencesStore.fetchPreferences();
});
</script>

<template>
	<div>
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</div>
</template>
