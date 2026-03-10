import { Redis } from 'ioredis';
import { loggers } from '../utils/logger';
import { env } from './env';

let redis: any = null;

// ============================================================================
// SHARED BULL CONNECTIONS
// Cada fila Bull cria 3 conexões por padrão (client, subscriber, bclient).
// Compartilhar client + subscriber reduz drásticamente o número de conexões.
// bclient DEVE ser uma nova conexão por worker (usado para BLPOP bloqueante).
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

let _sharedClient: Redis | null = null;
let _sharedSubscriber: Redis | null = null;

function getSharedClient(): Redis {
	if (!_sharedClient) {
		_sharedClient = new Redis(REDIS_BASE_OPTIONS);
		_sharedClient.on('error', (err) => loggers.cache.error({ err }, 'Redis [shared-client] error'));
	}
	return _sharedClient;
}

function getSharedSubscriber(): Redis {
	if (!_sharedSubscriber) {
		_sharedSubscriber = new Redis(REDIS_BASE_OPTIONS);
		_sharedSubscriber.on('error', (err) => loggers.cache.error({ err }, 'Redis [shared-subscriber] error'));
	}
	return _sharedSubscriber;
}

/**
 * Configuração Bull com conexões compartilhadas.
 * Usar em TODAS as filas para minimizar conexões abertas ao Redis.
 */
export function createBullConfig() {
	return {
		createClient(type: 'client' | 'subscriber' | 'bclient') {
			switch (type) {
				case 'client':
					return getSharedClient();
				case 'subscriber':
					return getSharedSubscriber();
				case 'bclient':
					// bclient não pode ser compartilhado — é bloqueante (BLPOP)
					return new Redis(REDIS_BASE_OPTIONS);
				default:
					return getSharedClient();
			}
		},
	};
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
