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
	// 1. Inicializar tema do localStorage se existir
	const savedTheme = localStorage.getItem('nexo.theme') as 'light' | 'dark' | null;
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
	applyTheme(defaultTheme);

	const isLoading = ref(false);

	async function fetchPreferences() {
		isLoading.value = true;
		try {
			const data = await dashboardService.getPreferences();
			if (data) {
				preferences.value = {
					...preferences.value,
					...data,
				};

				// Se o backend tiver um tema salvo, ele tem precedência?
				// Geralmente sim, mas se quisermos forçar o local...
				// Vamos manter a lógica: Backend > LocalStorage (sync)
				// Mas se o usuário mudar localmente antes do fetch, pode dar flash.
				// O ideal é: Use LocalStorage first (já feito no init).
				// Se backend retornar diferente, atualiza local e UI.
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
