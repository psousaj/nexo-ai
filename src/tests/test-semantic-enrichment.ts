/**
 * Test: Semantic Enrichment with TMDB Keywords
 *
 * Valida que o document enrichment melhora drasticamente a busca semântica
 * usando keywords, overview, tagline do TMDB
 */

import { db } from '@/db';
import { users, userAccounts, memoryItems } from '@/db/schema';
import { itemService } from '@/services/item-service';
import { tmdbService } from '@/services/enrichment/tmdb-service';
import { loggers } from '@/utils/logger';
import { eq } from 'drizzle-orm';

async function testSemanticEnrichment() {
	console.log('🧪 Teste: Document Enrichment com TMDB Keywords\n');

	try {
		// 1. SETUP: Criar usuário de teste
		console.log('📦 1. Criando usuário de teste...');
		const [user] = await db
			.insert(users)
			.values({ name: 'Test Enrichment', email: `test-enrich-${Date.now()}@example.com` })
			.returning();

		await db.insert(userAccounts).values({
			userId: user.id,
			provider: 'telegram',
			externalId: `test-enrich-${Date.now()}`,
		});

		console.log(`✅ Usuário criado: ${user.id}\n`);

		// 2. BUSCAR DADOS REAIS DO TMDB
		console.log('📦 2. Buscando dados REAIS do TMDB...\n');

		// Inception (filme sobre sonhos)
		const inceptionResults = await tmdbService.searchMovies('Inception');
		const inceptionTmdbId = inceptionResults[0]?.id;

		if (!inceptionTmdbId) {
			throw new Error('Inception não encontrado no TMDB');
		}

		const inceptionMetadata = await tmdbService.enrichMovie(inceptionTmdbId);

		console.log(`🎬 Inception TMDB Data:`);
		console.log(`   Keywords: ${inceptionMetadata.keywords?.join(', ') || 'N/A'}`);
		console.log(`   Overview: ${inceptionMetadata.overview?.substring(0, 80)}...`);
		console.log(`   Tagline: ${inceptionMetadata.tagline || 'N/A'}`);
		console.log(`   Genres: ${inceptionMetadata.genres.join(', ')}\n`);

		// Interstellar (exploração espacial)
		const interstellarResults = await tmdbService.searchMovies('Interstellar');
		const interstellarTmdbId = interstellarResults[0]?.id;

		if (!interstellarTmdbId) {
			throw new Error('Interstellar não encontrado no TMDB');
		}

		const interstellarMetadata = await tmdbService.enrichMovie(interstellarTmdbId);

		console.log(`🚀 Interstellar TMDB Data:`);
		console.log(`   Keywords: ${interstellarMetadata.keywords?.join(', ') || 'N/A'}`);
		console.log(`   Overview: ${interstellarMetadata.overview?.substring(0, 80)}...`);
		console.log(`   Genres: ${interstellarMetadata.genres.join(', ')}\n`);

		// 3. SALVAR COM METADATA ENRIQUECIDA
		console.log('📦 3. Salvando filmes com metadata TMDB completa...\n');

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

		console.log('✅ Filmes salvos com embeddings enriquecidos\n');

		// 4. BUSCAR SEMANTICAMENTE
		console.log('📦 4. Testando busca semântica com enrichment...\n');

		const dreamSearch = await itemService.searchItems({
			userId: user.id,
			query: 'filmes sobre sonhos e subconsciente',
			limit: 2,
		});

		console.log(`🔍 Query: "filmes sobre sonhos e subconsciente"\n`);

		for (const [index, result] of dreamSearch.entries()) {
			const similarity = (result as any).similarity;
			console.log(`   ${index + 1}. ${result.title} - ${(similarity * 100).toFixed(1)}% similar`);
		}

		// VALIDAÇÃO
		const topResult = dreamSearch[0];
		if (topResult?.title === 'Inception') {
			console.log('\n✅ SUCCESS: Inception é o TOP resultado!');
			console.log('   🔥 Document enrichment funcionou!\n');
		} else {
			console.log(`\n⚠️ WARNING: Top resultado foi "${topResult?.title}" (esperado: Inception)`);
			console.log('   Possíveis causas:');
			console.log('   - Keywords TMDB não foram buscadas');
			console.log('   - Overview não foi incluído no embedding');
			console.log('   - Modelo de embedding não capturou semântica\n');
		}

		// Mostrar documento semântico gerado
		console.log('📄 Documento Semântico Gerado (primeiros 300 chars):\n');
		const inceptionDoc = (itemService as any).prepareTextForEmbedding({
			type: 'movie',
			title: 'Inception',
			metadata: inceptionMetadata,
		});
		console.log(`   ${inceptionDoc.substring(0, 300)}...\n`);

		// 5. CLEANUP
		console.log('🧹 5. Limpando dados de teste...');
		await db.delete(memoryItems).where(eq(memoryItems.userId, user.id));
		await db.delete(userAccounts).where(eq(userAccounts.userId, user.id));
		await db.delete(users).where(eq(users.id, user.id));
		console.log('✅ Dados removidos\n');

		console.log('🎉 Teste concluído!');
		process.exit(0);
	} catch (error) {
		console.error('❌ Erro no teste:', error);
		process.exit(1);
	}
}

testSemanticEnrichment();
