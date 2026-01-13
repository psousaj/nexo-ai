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
	 * Define o nome customizado do assistente
	 */
	async setAssistantName(userId: string, name: string): Promise<void> {
		// Upsert: insere se não existe, atualiza se existe
		const existing = await db.select({ id: userPreferences.id }).from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);

		if (existing.length > 0) {
			await db.update(userPreferences).set({ assistantName: name, updatedAt: new Date() }).where(eq(userPreferences.userId, userId));
		} else {
			await db.insert(userPreferences).values({
				userId,
				assistantName: name,
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
