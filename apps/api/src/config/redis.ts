import { Redis } from 'ioredis';
import { loggers } from '../utils/logger';
import { env } from './env';

let redis: any = null;

// ============================================================================
// SHARED BULLMQ CONNECTION
// BullMQ usa uma única conexão IORedis por Queue/Worker.
// Compartilhar a mesma instância para minimizar conexões abertas ao Redis.
// ============================================================================

export const REDIS_BASE_OPTIONS = {
	host: env.REDIS_HOST || '',
	port: env.REDIS_PORT || 6379,
	password: env.REDIS_PASSWORD || '',
	username: env.REDIS_USER || '',
	maxRetriesPerRequest: null as null,
	enableReadyCheck: false,
	...(env.REDIS_TLS ? { tls: {} } : {}),
};

let _sharedConnection: Redis | null = null;

function getSharedConnection(): Redis {
	if (!_sharedConnection) {
		_sharedConnection = new Redis(REDIS_BASE_OPTIONS);
		_sharedConnection.on('error', (err) => loggers.cache.error({ err }, 'Redis [shared] error'));
	}
	return _sharedConnection;
}

/**
 * Retorna conexão IORedis compartilhada para BullMQ.
 * Usar em TODAS as filas/workers para minimizar conexões abertas ao Redis.
 */
export function getBullMQConnection(): Redis {
	return getSharedConnection();
}

/** @deprecated Use getBullMQConnection() — mantido para compatibilidade transitória */
export function createBullConfig() {
	return getBullMQConnection();
}

export async function getRedisClient(): Promise<Redis | null> {
	if (!env.REDIS_HOST || !env.REDIS_PASSWORD) {
		loggers.cache.warn('Redis não configurado - cache desabilitado');
		return null;
	}

	if (!redis) {
		try {
			const client = new Redis(REDIS_BASE_OPTIONS);
			client.on('error', (err) => loggers.cache.error({ err }, 'Redis [cache] error'));
			redis = client;
			loggers.cache.info('Redis conectado para cache');
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

export async function cacheSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
	const client = await getRedisClient();
	if (!client) return;

	try {
		const payload = JSON.stringify(value);

		if (ttlSeconds) {
			await client.setex(key, ttlSeconds, payload);
			loggers.cache.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
		} else {
			await client.set(key, payload);
			loggers.cache.debug(`Cache SET: ${key} (sem TTL)`);
		}
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
