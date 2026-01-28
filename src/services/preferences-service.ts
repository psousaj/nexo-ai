/**
 * Serviço de Preferências do Usuário
 *
 * Gerencia configurações personalizadas como nome do assistente.
 */

import { db } from '@/db';
import { userPreferences } from '@/db/schema';
import { eq } from 'drizzle-orm';

export class PreferencesService {
	/**
	 * Busca o nome customizado do assistente para o usuário
	 */
	async getAssistantName(userId: string): Promise<string | null> {
		const [prefs] = await db
			.select({ assistantName: userPreferences.assistantName })
			.from(userPreferences)
			.where(eq(userPreferences.userId, userId))
			.limit(1);

		return prefs?.assistantName ?? null;
	}

	/**
	 * Atalho para atualizar apenas o nome do assistente
	 */
	async setAssistantName(userId: string, assistantName: string): Promise<void> {
		await this.updatePreferences(userId, { assistantName });
	}

	/**
	 * Atualiza as preferências do usuário
	 */
	async updatePreferences(
		userId: string,
		updates: Partial<{
			assistantName: string;
			notificationsBrowser: boolean;
			notificationsWhatsapp: boolean;
			notificationsEmail: boolean;
			privacyShowMemoriesInSearch: boolean;
			privacyShareAnalytics: boolean;
			appearanceTheme: string;
			appearanceLanguage: string;
		}>,
	): Promise<void> {
		const existing = await db.select({ id: userPreferences.id }).from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);

		if (existing.length > 0) {
			await db
				.update(userPreferences)
				.set({ ...updates, updatedAt: new Date() })
				.where(eq(userPreferences.userId, userId));
		} else {
			await db.insert(userPreferences).values({
				userId,
				...updates,
			});
		}
	}

	/**
	 * Busca todas as preferências do usuário
	 */
	async getPreferences(userId: string) {
		const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);

		return prefs ?? null;
	}

	/**
	 * Cria preferências padrão para um novo usuário
	 */
	async createDefaultPreferences(userId: string) {
		await db.insert(userPreferences).values({
			userId,
		});
	}
}

export const preferencesService = new PreferencesService();
