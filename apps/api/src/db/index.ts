import * as schema from '@/db/schema';
import { captureException } from '@/sentry';
import { loggers } from '@/utils/logger';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env';

const log = loggers.db;
let client: postgres.Sql<{}>;
let healthInterval: ReturnType<typeof setInterval> | null = null;

const POOL_OPTIONS = {
	/** Max 25 connections no pool (default é 1 — causa quedas em idle) */
	max: 25,
	/** Fecha conexão idle após 60s pra liberar recursos */
	idle_timeout: 60,
	/** Vida máxima de 30min — força rotação pra evitar conexões zumbis */
	max_lifetime: 1800,
	/** Timeout de conexão: 30s */
	connect_timeout: 30,
	/** TCP keepalive pra NATs e load balancers não matarem a conexão */
	keepalives: 1,
	keepalives_idle: 30,
	keepalives_interval: 10,
	keepalives_count: 5,
	/** Previne prepared statements — essencial pro PgBouncer transaction mode */
	prepare: false,
	onnotice: (notice) => log.warn({ notice }, '⚠️ Postgres notice'),
	onclose: () => {
		log.warn('⚠️ Postgres connection closed — tentando reconexão...');
		captureException(new Error('Postgres connection closed unexpectedly'));
		startHealthCheck();
	},
} satisfies postgres.Options<{}>;

function createClient(): postgres.Sql<{}> {
	log.info({ poolSize: POOL_OPTIONS.max }, '🔌 Criando pool de conexões PostgreSQL');
	return postgres(env.DATABASE_URL, POOL_OPTIONS);
}

/**
 * Health check: testa a conexão periodicamente (a cada 30s).
 * Se falhar, destrói o client atual e cria um novo.
 */
async function checkConnection(): Promise<boolean> {
	try {
		await client`SELECT 1`;
		return true;
	} catch {
		return false;
	}
}

function startHealthCheck(): void {
	stopHealthCheck();
	healthInterval = setInterval(async () => {
		const ok = await checkConnection();
		if (!ok) {
			log.error('❌ Health check falhou — forçando reconexão...');
			try {
				await client.end({ timeout: 5 });
			} catch {}
			client = createClient();
			db = drizzle(client, { schema });
			log.info('✅ Reconectado ao PostgreSQL');
		}
	}, 30_000);
}

function stopHealthCheck(): void {
	if (healthInterval) {
		clearInterval(healthInterval);
		healthInterval = null;
	}
}

/** Inicializa o pool e o health check. */
export function initializeDatabase(): void {
	client = createClient();
	db = drizzle(client, { schema });
	startHealthCheck();
	log.info('✅ Pool de conexões inicializado');
}

/** Finaliza todas as conexões graciosamente. */
export async function shutdownDatabase(): Promise<void> {
	log.info('🛑 Finalizando pool de conexões...');
	stopHealthCheck();
	try {
		await client.end({ timeout: 10 });
	} catch (err) {
		log.error({ err }, 'Erro ao finalizar pool');
	}
}

// Lazy placeholder — real pool é criado via initializeDatabase()
export let db = {} as Database;

export type Database = typeof db;
