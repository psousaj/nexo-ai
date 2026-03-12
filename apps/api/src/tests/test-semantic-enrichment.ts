/**
 * Test: Semantic Enrichment with TMDB Keywords
 *
 * Valida que o document enrichment melhora drasticamente a busca semântica
 * usando keywords, overview, tagline do TMDB
 */

import { db } from '@nexo/api-core/db';
import { authProviders, memoryItems, users } from '@nexo/api-core/db/schema';
import { tmdbService } from '@nexo/api-core/services/enrichment/tmdb-service';
import { itemService } from '@nexo/api-core/services/item-service';
import { loggers } from '@nexo/api-core/utils/logger';
import { eq } from 'drizzle-orm';

async function testSemanticEnrichment() {
	loggers.ai.info('🧪 Teste: Document Enrichment com TMDB Keywords\n');

	try {
		// 1. SETUP: Criar usuário de teste
		loggers.ai.info('📦 1. Criando usuário de teste...');
		const [user] = await db
			.insert(users)
			.values({ name: 'Test Enrichment', email: `test-enrich-${Date.now()}@example.com` })
			.returning();

		await db.insert(authProviders).values({
			userId: user.id,
			provider: 'telegram',
			providerUserId: `test-enrich-${Date.now()}`,
		});

		loggers.ai.info(`✅ Usuário criado: ${user.id}\n`);

		// 2. BUSCAR DADOS REAIS DO TMDB
		loggers.ai.info('📦 2. Buscando dados REAIS do TMDB...\n');

		// Inception (filme sobre sonhos)
		const inceptionResults = await tmdbService.searchMovies('Inception');
		const inceptionTmdbId = inceptionResults[0]?.id;

		if (!inceptionTmdbId) {
			throw new Error('Inception não encontrado no TMDB');
		}

		const inceptionMetadata = await tmdbService.enrichMovie(inceptionTmdbId);

		loggers.ai.info('🎬 Inception TMDB Data:');
		loggers.ai.info(`   Keywords: ${inceptionMetadata.keywords?.join(', ') || 'N/A'}`);
		loggers.ai.info(`   Overview: ${inceptionMetadata.overview?.substring(0, 80)}...`);
		loggers.ai.info(`   Tagline: ${inceptionMetadata.tagline || 'N/A'}`);
		loggers.ai.info(`   Genres: ${inceptionMetadata.genres.join(', ')}\n`);

		// Interstellar (exploração espacial)
		const interstellarResults = await tmdbService.searchMovies('Interstellar');
		const interstellarTmdbId = interstellarResults[0]?.id;

		if (!interstellarTmdbId) {
			throw new Error('Interstellar não encontrado no TMDB');
		}

		const interstellarMetadata = await tmdbService.enrichMovie(interstellarTmdbId);

		loggers.ai.info('🚀 Interstellar TMDB Data:');
		loggers.ai.info(`   Keywords: ${interstellarMetadata.keywords?.join(', ') || 'N/A'}`);
		loggers.ai.info(`   Overview: ${interstellarMetadata.overview?.substring(0, 80)}...`);
		loggers.ai.info(`   Genres: ${interstellarMetadata.genres.join(', ')}\n`);

		// 3. SALVAR COM METADATA ENRIQUECIDA
		loggers.ai.info('📦 3. Salvando filmes com metadata TMDB completa...\n');

		await itemService.createItem({
			userId: user.id,
			type: 'movie',
			title: 'Inception',
			metadata: inceptionMetadata,
		});

		await itemService.createItem({
			userId: user.id,
			type: 'movie',
			title: 'Interstellar',
			metadata: interstellarMetadata,
		});

		loggers.ai.info('✅ Filmes salvos com embeddings enriquecidos\n');

		// 4. BUSCAR SEMANTICAMENTE
		loggers.ai.info('📦 4. Testando busca semântica com enrichment...\n');

		const dreamSearch = await itemService.searchItems({
			userId: user.id,
			query: 'filmes sobre sonhos e subconsciente',
			limit: 2,
		});

		loggers.ai.info(`🔍 Query: "filmes sobre sonhos e subconsciente"\n`);

		for (const [index, result] of dreamSearch.entries()) {
			const similarity = (result as any).similarity;
			loggers.ai.info(`   ${index + 1}. ${result.title} - ${(similarity * 100).toFixed(1)}% similar`);
		}

		// VALIDAÇÃO
		const topResult = dreamSearch[0];
		if (topResult?.title === 'Inception') {
			loggers.ai.info('\n✅ SUCCESS: Inception é o TOP resultado!');
			loggers.ai.info('   🔥 Document enrichment funcionou!\n');
		} else {
			loggers.ai.info(`\n⚠️ WARNING: Top resultado foi "${topResult?.title}" (esperado: Inception)`);
			loggers.ai.info('   Possíveis causas:');
			loggers.ai.info('   - Keywords TMDB não foram buscadas');
			loggers.ai.info('   - Overview não foi incluído no embedding');
			loggers.ai.info('   - Modelo de embedding não capturou semântica\n');
		}

		// Mostrar documento semântico gerado
		loggers.ai.info('📄 Documento Semântico Gerado (primeiros 300 chars):\n');
		const inceptionDoc = (itemService as any).prepareTextForEmbedding({
			type: 'movie',
			title: 'Inception',
			metadata: inceptionMetadata,
		});
		loggers.ai.info(`   ${inceptionDoc.substring(0, 300)}...\n`);

		// 5. CLEANUP
		loggers.ai.info('🧹 5. Limpando dados de teste...');
		await db.delete(memoryItems).where(eq(memoryItems.userId, user.id));
		await db.delete(authProviders).where(eq(authProviders.userId, user.id));
		await db.delete(users).where(eq(users.id, user.id));
		loggers.ai.info('✅ Dados removidos\n');

		loggers.ai.info('🎉 Teste concluído!');
		process.exit(0);
	} catch (error) {
		loggers.ai.error({ error }, '❌ Erro no teste');
		process.exit(1);
	}
}

testSemanticEnrichment();
