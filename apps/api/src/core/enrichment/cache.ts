const store = new Map<string, { value: unknown; expiresAt: number }>();

export async function cacheGet<T>(key: string): Promise<T | null> {
	const entry = store.get(key);
	if (!entry || Date.now() > entry.expiresAt) {
		store.delete(key);
		return null;
	}
	return entry.value as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
	store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}
