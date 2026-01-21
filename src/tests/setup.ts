import { beforeAll, afterAll } from 'vitest';

// Configurar variáveis de ambiente para testes
process.env.NODE_ENV = 'test';

// Usar o mesmo banco para testes (simplificado)
// Nota: Em produção, use um banco separado
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/nexo';

// Configurar mocks para testes que não precisam de DB
beforeAll(async () => {
	console.log('✅ Ambiente de teste configurado');
});

// Limpar dados após todos os testes (opcional)
afterAll(async () => {
	console.log('🧹 Testes finalizados');
});
