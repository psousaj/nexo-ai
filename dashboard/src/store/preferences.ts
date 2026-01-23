import { defineStore } from 'pinia';
import { ref } from 'vue';
import { dashboardService } from '../services/dashboard.service';

export interface UserPreferences {
	assistantName: string;
	notificationsBrowser: boolean;
	notificationsWhatsapp: boolean;
	notificationsEmail: boolean;
	privacyShowMemoriesInSearch: boolean;
	privacyShareAnalytics: boolean;
	appearanceTheme: 'light' | 'dark';
	appearanceLanguage: string;
}

export const usePreferencesStore = defineStore('preferences', () => {
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

	async function fetchPreferences() {
		isLoading.value = true;
		try {
			const data = await dashboardService.getPreferences();
			if (data) {
				preferences.value = {
					...preferences.value,
					...data,
					// Garantir que tipos booleanos sejam respeitados se o backend retornar 0/1 (embora PostgreSQL use boolean real)
				};

				// Aplicar tema imediatamente
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
			await dashboardService.updatePreferences(updates);
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
		if (theme === 'dark') {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}

	return {
		preferences,
		isLoading,
		fetchPreferences,
		updatePreferences,
	};
});
