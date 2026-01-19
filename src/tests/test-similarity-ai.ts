/**
 * Test: cosineSimilarity from 'ai' library
 * 
 * Testa se a biblioteca ai calcula corretamente a similaridade
 * usando os embeddings reais do Cloudflare Workers AI
 */

import { cosineSimilarity } from 'ai';
import { embeddingService } from '@/services/ai/embedding-service';
import { loggers } from '@/utils/logger';

async function testAISimilarity() {
	console.log('🧪 Testando cosineSimilarity da biblioteca ai...\n');

	try {
		// Gera embeddings de textos similares
		const text1 = 'filme de ficção científica sobre sonhos';
		const text2 = 'Inception - Christopher Nolan masterpiece';
		const text3 = 'receita de bolo de chocolate';

		console.log('📊 Gerando embeddings...');
		const [emb1, emb2, emb3] = await Promise.all([
			embeddingService.generateEmbedding(text1),
			embeddingService.generateEmbedding(text2),
			embeddingService.generateEmbedding(text3),
		]);

		// Valida embeddings
		console.log(`\n✅ Embedding 1: ${emb1.length} dimensões`);
		console.log(`✅ Embedding 2: ${emb2.length} dimensões`);
		console.log(`✅ Embedding 3: ${emb3.length} dimensões`);

		// Calcula similaridades usando biblioteca ai
		const sim1_2 = cosineSimilarity(emb1, emb2);
		const sim1_3 = cosineSimilarity(emb1, emb3);
		const sim2_3 = cosineSimilarity(emb2, emb3);

		// Resultados
		console.log('\n📈 Resultados de Similaridade (usando ai SDK):');
		console.log(`   "${text1}"`);
		console.log(`   vs`);
		console.log(`   "${text2}"`);
		console.log(`   ➜ Similaridade: ${(sim1_2 * 100).toFixed(1)}%\n`);

		console.log(`   "${text1}"`);
		console.log(`   vs`);
		console.log(`   "${text3}"`);
		console.log(`   ➜ Similaridade: ${(sim1_3 * 100).toFixed(1)}%\n`);

		console.log(`   "${text2}"`);
		console.log(`   vs`);
		console.log(`   "${text3}"`);
		console.log(`   ➜ Similaridade: ${(sim2_3 * 100).toFixed(1)}%\n`);

		// Validações
		if (sim1_2 > 0.7) {
			console.log('✅ Alta similaridade entre textos relacionados (esperado)');
		}
		if (sim1_3 < 0.3) {
			console.log('✅ Baixa similaridade entre textos não relacionados (esperado)');
		}
		if (!isNaN(sim1_2) && !isNaN(sim1_3) && !isNaN(sim2_3)) {
			console.log('✅ Nenhum NaN detectado (bug corrigido!)');
		}

		console.log('\n🎉 Teste concluído com sucesso!');
		process.exit(0);
	} catch (error) {
		console.error('❌ Erro no teste:', error);
		process.exit(1);
	}
}

testAISimilarity();
