import { Redis } from '@upstash/redis';
import { env } from './env';
import { logger } from '@/utils/logger';

let redis: Redis | null = null;

export function getRedisClient(): Redis | null {
	if (!env.UPSTASH_REDIS_URL || !env.UPSTASH_REDIS_TOKEN) {
		logger.warn('Redis não configurado - cache desabilitado');
		return null;
	}

	if (!redis) {
		redis = new Redis({
			url: env.UPSTASH_REDIS_URL,
			token: env.UPSTASH_REDIS_TOKEN,
		});
		logger.info('Redis conectado');
	}

	return redis;
}

/**
 * Cache helper com fallback silencioso
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
	const client = getRedisClient();
	if (!client) return null;

	try {
		const value = await client.get<T>(key);
		if (value) {
			logger.debug(`Cache HIT: ${key}`);
		}
		return value;
	} catch (error) {
		logger.error({ key, error }, 'Redis GET error');
		return null;
	}
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
	const client = getRedisClient();
	if (!client) return;

	try {
		await client.set(key, value, { ex: ttlSeconds });
		logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
	} catch (error) {
		logger.error({ key, error }, 'Redis SET error');
	}
}

export async function cacheDelete(key: string): Promise<void> {
	const client = getRedisClient();
	if (!client) return;

	try {
		await client.del(key);
		logger.debug(`Cache DELETE: ${key}`);
	} catch (error) {
		logger.error({ key, error }, 'Redis DELETE error');
	}
}
