<script setup lang="ts">
import { SpeedInsights } from '@vercel/speed-insights/nuxt';
import { Analytics } from '@vercel/analytics/nuxt';
import { useAuthStore } from './stores/auth';
import { usePreferencesStore } from './stores/preferences';

const authStore = useAuthStore();
const preferencesStore = usePreferencesStore();

onMounted(() => {
	preferencesStore.initializeTheme();
});

// Busca preferências apenas quando autenticado (evita 401 antes da sessão carregar)
watch(
	() => authStore.isAuthenticated,
	(isAuth) => {
		if (isAuth) {
			preferencesStore.fetchPreferences();
		}
	},
	{ immediate: true },
);
</script>

<template>
	<div>
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</div>
</template>
