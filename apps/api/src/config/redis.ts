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

// ============================================================================
// IN-MEMORY FALLBACK CACHE
// Usado quando Redis está indisponível (ENOTFOUND, timeout, etc.)
// TTL máximo de 5 minutos para evitar memory leak.
// ============================================================================

const MEMORY_CACHE_MAX_ENTRIES = 500;
const MEMORY_CACHE_MAX_TTL_MS = 5 * 60 * 1000;

// LRU cache: Map preserves insertion order.
// On get() we delete+reinsert to move the entry to the end (most recently used).
// On eviction we drop the first key (least recently used).
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

function memoryCacheGet(key: string): string | null {
	const entry = memoryCache.get(key);
	if (!entry) return null;
	if (Date.now() > entry.expiresAt) {
		memoryCache.delete(key);
		return null;
	}
	// LRU: reinsert to move to end (most recently used)
	memoryCache.delete(key);
	memoryCache.set(key, entry);
	return entry.value;
}

function memoryCacheSet(key: string, value: string, ttlSeconds?: number): void {
	// Enforce max TTL of 5 minutes
	const cappedTtl = ttlSeconds ? Math.min(ttlSeconds, 300) : 300;
	const ttlMs = cappedTtl * 1000;

	if (memoryCache.size >= MEMORY_CACHE_MAX_ENTRIES) {
		const oldestKey = memoryCache.keys().next().value;
		if (oldestKey) memoryCache.delete(oldestKey);
	}
	memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function memoryCacheDelete(key: string): void {
	memoryCache.delete(key);
}

let _sharedConnection: Redis | null = null;
let _connectionHealthy = true;

function getSharedConnection(): Redis {
	if (!_sharedConnection) {
		_sharedConnection = new Redis(REDIS_BASE_OPTIONS);
		_sharedConnection.on('error', (err) => {
			_connectionHealthy = false;
			loggers.cache.error({ err }, 'Redis [shared] error');
		});
		_sharedConnection.on('connect', () => {
			_connectionHealthy = true;
		});
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

/**
 * Verifica se o Redis está respondendo (ping/pong).
 * Usado como health check periódico.
 */
export async function checkRedisHealth(): Promise<{ ok: boolean; latencyMs: number }> {
	const client = await getRedisClient();
	if (!client) return { ok: false, latencyMs: 0 };

	const start = Date.now();
	try {
		const pong = await client.ping();
		const latencyMs = Date.now() - start;
		_connectionHealthy = pong === 'PONG';
		return { ok: _connectionHealthy, latencyMs };
	} catch (error) {
		_connectionHealthy = false;
		loggers.cache.warn({ err: error }, 'Redis health check failed');
		return { ok: false, latencyMs: Date.now() - start };
	}
}

export async function getRedisClient(): Promise<Redis | null> {
	if (!env.REDIS_HOST || !env.REDIS_PASSWORD) {
		loggers.cache.warn('Redis não configurado - cache desabilitado');
		return null;
	}

	if (!redis) {
		try {
			const client = new Redis(REDIS_BASE_OPTIONS);
			client.on('error', (err) => {
				_connectionHealthy = false;
				loggers.cache.error({ err }, 'Redis [cache] error');
			});
			client.on('connect', () => {
				_connectionHealthy = true;
			});
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
 * Cache helper com fallback para in-memory quando Redis está indisponível.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
	const client = await getRedisClient();
	if (!client) {
		const raw = memoryCacheGet(key);
		return raw ? (JSON.parse(raw) as T) : null;
	}

	try {
		const raw = await client.get(key);
		if (!raw) return null;

		loggers.cache.debug(`Cache HIT: ${key}`);

		return JSON.parse(raw) as T;
	} catch (error) {
		loggers.cache.warn({ key, error }, 'Redis GET error — fallback in-memory');
		const raw = memoryCacheGet(key);
		return raw ? (JSON.parse(raw) as T) : null;
	}
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
	const client = await getRedisClient();
	if (!client) {
		memoryCacheSet(key, JSON.stringify(value), ttlSeconds);
		return;
	}

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
		loggers.cache.warn({ key, error }, 'Redis SET error — fallback in-memory');
		memoryCacheSet(key, JSON.stringify(value), ttlSeconds);
	}
}

export async function cacheDelete(key: string): Promise<void> {
	const client = await getRedisClient();
	if (!client) {
		memoryCacheDelete(key);
		return;
	}

	try {
		await client.del(key);
		loggers.cache.debug(`Cache DELETE: ${key}`);
	} catch (error) {
		loggers.cache.warn({ key, error }, 'Redis DELETE error — fallback in-memory');
		memoryCacheDelete(key);
	}
}
