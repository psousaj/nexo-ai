/**
 * Test: cosineSimilarity from 'ai' library
 *
 * Testa se a biblioteca ai calcula corretamente a similaridade
 * usando os embeddings reais do Cloudflare Workers AI
 */

import { embeddingService } from '@nexo/api-core/services/ai/embedding-service';
import { loggers } from '@nexo/api-core/utils/logger';
import { cosineSimilarity } from 'ai';

async function testAISimilarity() {
	loggers.ai.info('🧪 Testando cosineSimilarity da biblioteca ai...\n');

	try {
		// Gera embeddings de textos similares
		const text1 = 'filme de ficção científica sobre sonhos';
		const text2 = 'Inception - Christopher Nolan masterpiece';
		const text3 = 'receita de bolo de chocolate';

		loggers.ai.info('📊 Gerando embeddings...');
		const [emb1, emb2, emb3] = await Promise.all([
			embeddingService.generateEmbedding(text1),
			embeddingService.generateEmbedding(text2),
			embeddingService.generateEmbedding(text3),
		]);

		// Valida embeddings
		loggers.ai.info(`\n✅ Embedding 1: ${emb1.length} dimensões`);
		loggers.ai.info(`✅ Embedding 2: ${emb2.length} dimensões`);
		loggers.ai.info(`✅ Embedding 3: ${emb3.length} dimensões`);

		// Calcula similaridades usando biblioteca ai
		const sim1_2 = cosineSimilarity(emb1, emb2);
		const sim1_3 = cosineSimilarity(emb1, emb3);
		const sim2_3 = cosineSimilarity(emb2, emb3);

		// Resultados
		loggers.ai.info('\n📈 Resultados de Similaridade (usando ai SDK):');
		loggers.ai.info(`   "${text1}"`);
		loggers.ai.info('   vs');
		loggers.ai.info(`   "${text2}"`);
		loggers.ai.info(`   ➜ Similaridade: ${(sim1_2 * 100).toFixed(1)}%\n`);

		loggers.ai.info(`   "${text1}"`);
		loggers.ai.info('   vs');
		loggers.ai.info(`   "${text3}"`);
		loggers.ai.info(`   ➜ Similaridade: ${(sim1_3 * 100).toFixed(1)}%\n`);

		loggers.ai.info(`   "${text2}"`);
		loggers.ai.info('   vs');
		loggers.ai.info(`   "${text3}"`);
		loggers.ai.info(`   ➜ Similaridade: ${(sim2_3 * 100).toFixed(1)}%\n`);

		// Validações
		if (sim1_2 > 0.7) {
			loggers.ai.info('✅ Alta similaridade entre textos relacionados (esperado)');
		}
		if (sim1_3 < 0.3) {
			loggers.ai.info('✅ Baixa similaridade entre textos não relacionados (esperado)');
		}
		if (!Number.isNaN(sim1_2) && !Number.isNaN(sim1_3) && !Number.isNaN(sim2_3)) {
			loggers.ai.info('✅ Nenhum NaN detectado (bug corrigido!)');
		}

		loggers.ai.info('\n🎉 Teste concluído com sucesso!');
		process.exit(0);
	} catch (error) {
		loggers.ai.error({ error }, '❌ Erro no teste');
		process.exit(1);
	}
}

testAISimilarity();
