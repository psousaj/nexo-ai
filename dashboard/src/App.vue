<script setup lang="ts">
import { onMounted } from 'vue';
import MainLayout from './components/MainLayout.vue';
import { usePreferencesStore } from './store/preferences';

const preferencesStore = usePreferencesStore();

onMounted(() => {
	preferencesStore.fetchPreferences();
});
</script>

<template>
	<MainLayout v-if="!$route.meta.public" />
	<router-view v-else />
</template>

<style>
/* Global styles are in main.css */
</style>
