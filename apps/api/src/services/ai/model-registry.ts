import { db } from '@/db';
import { modelRegistry } from '@/db/schema';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import type { AIProviderType, ModelContextType, ModelRegistryEntry } from './types';

export class ModelRegistryService {
	async searchModels(params?: {
		query?: string;
		provider?: AIProviderType;
		contextType?: ModelContextType;
	}): Promise<ModelRegistryEntry[]> {
		const conditions = [];

		if (params?.query) {
			conditions.push(
				or(
					ilike(modelRegistry.modelId, `%${params.query}%`),
					ilike(modelRegistry.displayName, `%${params.query}%`),
				),
			);
		}
		if (params?.provider) {
			conditions.push(eq(modelRegistry.provider, params.provider));
		}

		const rows = await db
			.select()
			.from(modelRegistry)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(modelRegistry.priority), desc(modelRegistry.isDefault))
			.limit(50);

		return rows.map((r) => this.toEntry(r));
	}

	async getEnabledModels(provider?: AIProviderType, contextType?: ModelContextType): Promise<ModelRegistryEntry[]> {
		const conditions = [eq(modelRegistry.enabled, true)];
		if (provider) conditions.push(eq(modelRegistry.provider, provider));

		const rows = await db
			.select()
			.from(modelRegistry)
			.where(and(...conditions))
			.orderBy(desc(modelRegistry.priority), desc(modelRegistry.isDefault));

		let entries = rows.map((r) => this.toEntry(r));
		if (contextType) {
			entries = entries.filter((m) => m.contextTypes.includes(contextType));
		}
		return entries;
	}

	async getOrCreateModel(
		provider: string,
		modelId: string,
		defaults?: { displayName?: string; contextTypes?: string[] },
	): Promise<ModelRegistryEntry> {
		const existing = await db
			.select()
			.from(modelRegistry)
			.where(and(eq(modelRegistry.provider, provider), eq(modelRegistry.modelId, modelId)))
			.limit(1);

		if (existing.length > 0) {
			return this.toEntry(existing[0]);
		}

		const [inserted] = await db
			.insert(modelRegistry)
			.values({
				provider,
				modelId,
				displayName: defaults?.displayName ?? null,
				contextTypes: defaults?.contextTypes ?? ['chat'],
			})
			.returning();

		return this.toEntry(inserted);
	}

	async addModel(params: {
		provider: string;
		modelId: string;
		displayName?: string;
		enabled?: boolean;
		priority?: number;
		isDefault?: boolean;
		contextTypes?: string[];
	}): Promise<ModelRegistryEntry> {
		const [inserted] = await db.insert(modelRegistry).values(params).returning();
		return this.toEntry(inserted);
	}

	async updateModel(
		id: number,
		params: {
			displayName?: string;
			enabled?: boolean;
			priority?: number;
			isDefault?: boolean;
			contextTypes?: string[];
		},
	): Promise<ModelRegistryEntry> {
		const [updated] = await db.update(modelRegistry).set(params).where(eq(modelRegistry.id, id)).returning();
		return this.toEntry(updated);
	}

	async removeModel(id: number): Promise<void> {
		await db.delete(modelRegistry).where(eq(modelRegistry.id, id));
	}

	private toEntry(row: any): ModelRegistryEntry {
		return {
			...row,
			contextTypes: Array.isArray(row.contextTypes) ? row.contextTypes : ['chat'],
			createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
			updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
		};
	}
}

export const modelRegistryService = new ModelRegistryService();
