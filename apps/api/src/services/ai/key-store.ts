import { db } from '@/db';
import { providerKeys } from '@/db/schema/provider-keys';
import { eq } from 'drizzle-orm';
import { decrypt, encrypt, fingerprint } from './crypto';
import type { AIProviderType } from './types';

interface KeyEntry {
	key: string;
	fingerprint: string | null;
	config: Record<string, string>;
}

export class KeyStore {
	async setKey(provider: AIProviderType, key: string, config?: Record<string, string>): Promise<void> {
		const encrypted = encrypt(key);
		const fp = fingerprint(key);

		await db
			.insert(providerKeys)
			.values({
				provider,
				encryptedKey: encrypted,
				keyFingerprint: fp,
				config: config ?? {},
			})
			.onConflictDoUpdate({
				target: providerKeys.provider,
				set: {
					encryptedKey: encrypted,
					keyFingerprint: fp,
					config: config ?? {},
					updatedAt: new Date(),
				},
			});
	}

	async getKey(provider: AIProviderType): Promise<KeyEntry | null> {
		const row = await db.select().from(providerKeys).where(eq(providerKeys.provider, provider)).limit(1);

		if (row.length === 0) return null;

		const decrypted = decrypt(row[0].encryptedKey);
		return {
			key: decrypted,
			fingerprint: row[0].keyFingerprint ?? null,
			config: (row[0].config as Record<string, string>) ?? {},
		};
	}

	async deleteKey(provider: AIProviderType): Promise<void> {
		await db.delete(providerKeys).where(eq(providerKeys.provider, provider));
	}

	async hasKey(provider: AIProviderType): Promise<boolean> {
		const row = await db.select().from(providerKeys).where(eq(providerKeys.provider, provider)).limit(1);
		return row.length > 0;
	}

	async listKeys(): Promise<Array<{ provider: string; fingerprint: string | null; config: Record<string, string> }>> {
		const rows = await db.select().from(providerKeys);
		return rows.map((r) => ({
			provider: r.provider,
			fingerprint: r.keyFingerprint ?? null,
			config: (r.config as Record<string, string>) ?? {},
		}));
	}
}

export const keyStore = new KeyStore();
