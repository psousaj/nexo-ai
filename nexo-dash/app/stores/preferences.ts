import type { UserPreferences } from '~/types/dashboard';
import { useDashboard } from '~/composables/useDashboard';

export const usePreferencesStore = defineStore('preferences', () => {
	const dashboard = useDashboard();

	// 1. Inicializar tema do localStorage se existir
	const savedTheme = process.client ? (localStorage.getItem('nexo.theme') as 'light' | 'dark' | null) : null;
	const defaultTheme = savedTheme || 'dark';

	const preferences = ref<UserPreferences>({
		assistantName: 'Nexo AI',
		notificationsBrowser: true,
		notificationsWhatsapp: true,
		notificationsEmail: false,
		privacyShowMemoriesInSearch: false,
		privacyShareAnalytics: true,
		appearanceTheme: defaultTheme,
		appearanceLanguage: 'pt-BR',
	});

	// Aplicar tema inicial imediatamente
	if (process.client) {
		applyTheme(defaultTheme);
	}

	const isLoading = ref(false);

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
	};
});
