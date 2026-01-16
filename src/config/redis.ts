import { Redis } from 'redis';
import { env } from './env';
import { loggers } from '../utils/logger';

let redis: Redis | null = null;

export async function getRedisClient(): Redis | null {
	if (!env.REDIS_HOST || !env.REDIS_PASSWORD) {
		loggers.cache.warn('Redis não configurado - cache desabilitado');
		return null;
	}

	if (!redis) {
		const client = createClient({
			username: env.REDIS_USER,
			password: env.REDIS_PASSWORD,
			socket: {
				host: env.REDIS_HOST,
				port: env.REDIS_PORT,
			},
		});

		client.on('error', (err) => loggers.cache.error({ err }, 'Redis Client Error'));

		await client.connect();

		loggers.cache.info('Redis conectado');
	}

	return redis;
}

/**
 * Cache helper com fallback silencioso
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
	const client = await getRedisClient();
	if (!client) return null;

	try {
		const value = await client.get<T>(key);
		if (value) {
			loggers.cache.debug(`Cache HIT: ${key}`);
		}
		return value;
	} catch (error) {
		loggers.cache.error({ key, error }, 'Redis GET error');
		return null;
	}
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
	const client = getRedisClient();
	if (!client) return;

	try {
		await client.set(key, value, { ex: ttlSeconds });
		loggers.cache.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
	} catch (error) {
		loggers.cache.error({ key, error }, 'Redis SET error');
	}
}

export async function cacheDelete(key: string): Promise<void> {
	const client = getRedisClient();
	if (!client) return;

	try {
		await client.del(key);
		loggers.cache.debug(`Cache DELETE: ${key}`);
	} catch (error) {
		loggers.cache.error({ key, error }, 'Redis DELETE error');
	}
}
