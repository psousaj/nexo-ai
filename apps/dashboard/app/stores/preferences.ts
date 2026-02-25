import { useDashboard } from '~/composables/useDashboard';
import type { UserPreferences } from '~/types/dashboard';

export const usePreferencesStore = defineStore('preferences', () => {
	const dashboard = useDashboard();

	// Inicializar sempre com 'dark' para garantir consistência SSR
	// O tema do localStorage será aplicado apenas após hydration
	const preferences = ref<UserPreferences>({
		assistantName: 'Nexo AI',
		notificationsBrowser: true,
		notificationsWhatsapp: true,
		notificationsEmail: false,
		privacyShowMemoriesInSearch: false,
		privacyShareAnalytics: true,
		appearanceTheme: 'dark',
		appearanceLanguage: 'pt-BR',
	});

	const isLoading = ref(false);
	const _isInitialized = ref(false);

	// Função para inicializar o tema do localStorage após hydration
	function initializeTheme() {
		if (!process.client || _isInitialized.value) return;

		const savedTheme = localStorage.getItem('nexo.theme') as 'light' | 'dark' | null;
		if (savedTheme) {
			preferences.value.appearanceTheme = savedTheme;
			applyTheme(savedTheme);
		} else {
			applyTheme('dark');
		}
		_isInitialized.value = true;
	}

	async function fetchPreferences() {
		isLoading.value = true;
		try {
			const data = await dashboard.getPreferences();
			if (data) {
				preferences.value = {
					...preferences.value,
					...data,
				};

				// Se o backend tiver um tema salvo, ele tem precedência
				applyTheme(preferences.value.appearanceTheme);
			}
		} catch (error) {
			console.error('Failed to fetch preferences:', error);
		} finally {
			isLoading.value = false;
		}
	}

	async function updatePreferences(updates: Partial<UserPreferences>) {
		try {
			await dashboard.updatePreferences(updates);
			preferences.value = { ...preferences.value, ...updates };

			if (updates.appearanceTheme) {
				applyTheme(updates.appearanceTheme);
			}
		} catch (error) {
			console.error('Failed to update preferences:', error);
			throw error;
		}
	}

	function applyTheme(theme: 'light' | 'dark') {
		if (!process.client) return;

		if (theme === 'dark') {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
		// Persistir no localStorage
		localStorage.setItem('nexo.theme', theme);
	}

	return {
		preferences,
		isLoading,
		fetchPreferences,
		updatePreferences,
		initializeTheme,
	};
});
