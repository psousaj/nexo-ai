import { loggers } from '@/utils/logger';
import { afterAll, beforeAll } from 'vitest';

// Configurar variáveis de ambiente para testes
process.env.NODE_ENV = 'test';

// Usar o mesmo banco para testes (simplificado)
// Nota: Em produção, use um banco separado
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/nexo';
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'test-telegram-token';
process.env.CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'test-account-id';
process.env.CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'test-api-token';
process.env.CLOUDFLARE_GATEWAY_ID = process.env.CLOUDFLARE_GATEWAY_ID || 'nexo-ai-gateway';
process.env.TMDB_API_KEY = process.env.TMDB_API_KEY || 'test-tmdb-key';
process.env.YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'test-youtube-key';
process.env.SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'test-spotify-client-id';
process.env.SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'test-spotify-client-secret';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_USER = process.env.REDIS_USER || 'default';
process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'test-password';

// Configurar mocks para testes que não precisam de DB
beforeAll(async () => {
	loggers.ai.info('✅ Ambiente de teste configurado');
});

// Limpar dados após todos os testes (opcional)
afterAll(async () => {
	loggers.ai.info('🧹 Testes finalizados');
});
