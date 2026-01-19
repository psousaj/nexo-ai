import { Redis } from 'ioredis';
import { env } from './env';
import { loggers } from '../utils/logger';

let redis: any = null;

export async function getRedisClient(): Promise<Redis | null> {
	if (!env.REDIS_HOST || !env.REDIS_PASSWORD) {
		loggers.cache.warn('Redis não configurado - cache desabilitado');
		return null;
	}

	if (!redis) {
		try {
			// const client = new Redis({
			// 	host: env.REDIS_HOST,
			// 	port: env.REDIS_PORT,
			// 	username: env.REDIS_USER,
			// 	password: env.REDIS_PASSWORD,
			// });

			const client = new Redis(`rediss://${env.REDIS_USER}:${env.REDIS_PASSWORD}@${env.REDIS_HOST}:${env.REDIS_PORT}`);

			client.on('error', (err) => loggers.cache.error({ err }, 'Redis Client Error'));

			await client.connect();
			redis = client;
			loggers.cache.info('Redis conectado');
		} catch (error) {
			loggers.cache.error({ err: error }, 'Falha ao conectar no Redis');
			return null;
		}
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
		const raw = await client.get(key);
		if (!raw) return null;

		loggers.cache.debug(`Cache HIT: ${key}`);

		return JSON.parse(raw) as T;
	} catch (error) {
		loggers.cache.error({ key, error }, 'Redis GET error');
		return null;
	}
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
	const client = await getRedisClient();
	if (!client) return;

	try {
		const payload = JSON.stringify(value);

		await client.set(key, payload);
	} catch (error) {
		loggers.cache.error({ key, error }, 'Redis SET error');
	}
}

export async function cacheDelete(key: string): Promise<void> {
	const client = await getRedisClient();
	if (!client) return;

	try {
		await client.del(key);
		loggers.cache.debug(`Cache DELETE: ${key}`);
	} catch (error) {
		loggers.cache.error({ key, error }, 'Redis DELETE error');
	}
}
