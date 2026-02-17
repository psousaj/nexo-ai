import { loggers } from '@/utils/logger';
import { afterAll, beforeAll } from 'vitest';

// Configurar variáveis de ambiente para testes
process.env.NODE_ENV = 'test';

// Usar o mesmo banco para testes (simplificado)
// Nota: Em produção, use um banco separado
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/nexo';

// Configurar mocks para testes que não precisam de DB
beforeAll(async () => {
	loggers.ai.info('✅ Ambiente de teste configurado');
});

// Limpar dados após todos os testes (opcional)
afterAll(async () => {
	loggers.ai.info('🧹 Testes finalizados');
});
