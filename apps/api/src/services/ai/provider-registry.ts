import { db } from '@/db';
import { providers } from '@/db/schema/providers';
import { loggers } from '@/utils/logger';
import { asc, eq } from 'drizzle-orm';
import type { ProviderEntry } from './types';
import type { AIProviderType } from './types';

export class ProviderRegistryService {
	async listAll(): Promise<ProviderEntry[]> {
		const rows = await db.select().from(providers).orderBy(asc(providers.priority));
		return rows.map((r) => ({
			...r,
			type: r.type as AIProviderType,
			config: (r.config as Record<string, string>) ?? {},
		}));
	}

	async getEnabled(): Promise<ProviderEntry[]> {
		const rows = await db.select().from(providers).where(eq(providers.enabled, true)).orderBy(asc(providers.priority));
		return rows.map((r) => ({
			...r,
			type: r.type as AIProviderType,
			config: (r.config as Record<string, string>) ?? {},
		}));
	}

	async getById(id: number): Promise<ProviderEntry | null> {
		const rows = await db.select().from(providers).where(eq(providers.id, id)).limit(1);
		if (rows.length === 0) return null;
		return {
			...rows[0],
			type: rows[0].type as AIProviderType,
			config: (rows[0].config as Record<string, string>) ?? {},
		};
	}

	async getByType(type: AIProviderType): Promise<ProviderEntry | null> {
		const rows = await db.select().from(providers).where(eq(providers.type, type)).limit(1);
		if (rows.length === 0) return null;
		return {
			...rows[0],
			type: rows[0].type as AIProviderType,
			config: (rows[0].config as Record<string, string>) ?? {},
		};
	}

	async create(data: {
		type: AIProviderType;
		label: string;
		enabled?: boolean;
		priority?: number;
		config?: Record<string, string>;
	}): Promise<ProviderEntry> {
		const rows = await db
			.insert(providers)
			.values({
				type: data.type,
				label: data.label,
				enabled: data.enabled ?? true,
				priority: data.priority ?? 0,
				config: data.config ?? {},
			})
			.returning();

		const row = rows[0];
		loggers.ai.info(`Provider "${data.label}" (${data.type}) registered`);
		return {
			...row,
			type: row.type as AIProviderType,
			config: (row.config as Record<string, string>) ?? {},
		};
	}

	async update(
		id: number,
		data: {
			label?: string;
			enabled?: boolean;
			priority?: number;
			config?: Record<string, string>;
			type?: AIProviderType;
		},
	): Promise<ProviderEntry | null> {
		const updateData: Record<string, unknown> = {};
		if (data.label !== undefined) updateData.label = data.label;
		if (data.enabled !== undefined) updateData.enabled = data.enabled;
		if (data.priority !== undefined) updateData.priority = data.priority;
		if (data.config !== undefined) updateData.config = data.config;
		if (data.type !== undefined) updateData.type = data.type;
		updateData.updatedAt = new Date();

		const rows = await db.update(providers).set(updateData).where(eq(providers.id, id)).returning();
		if (rows.length === 0) return null;
		return {
			...rows[0],
			type: rows[0].type as AIProviderType,
			config: (rows[0].config as Record<string, string>) ?? {},
		};
	}

	async remove(id: number): Promise<void> {
		await db.delete(providers).where(eq(providers.id, id));
	}

	async seedDefaults(): Promise<void> {
		const existing = await db.select().from(providers);
		if (existing.length > 0) return;

		await db.insert(providers).values([
			{ type: 'cloudflare', label: 'Cloudflare AI Gateway', enabled: true, priority: 0, config: {} },
			{ type: 'openai', label: 'OpenAI', enabled: true, priority: 1, config: {} },
			{
				type: 'deepseek',
				label: 'DeepSeek',
				enabled: true,
				priority: 2,
				config: { baseUrl: 'https://api.deepseek.com' },
			},
		]);

		loggers.ai.info('Seeded default AI providers (cloudflare, openai, deepseek)');
	}
}

export const providerRegistryService = new ProviderRegistryService();
