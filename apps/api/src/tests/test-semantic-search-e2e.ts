/**
 * Test: Semantic Search End-to-End
 *
 * Testa o fluxo completo:
 * 1. Criar usuário
 * 2. Salvar filmes com embeddings
 * 3. Buscar semanticamente
 * 4. Verificar resultados
 */

import { db } from '@nexo/api-core/db';
import { authProviders, memoryItems, users } from '@nexo/api-core/db/schema';
import { itemService } from '@nexo/api-core/services/item-service';
import { loggers } from '@nexo/api-core/utils/logger';
import { eq } from 'drizzle-orm';

async function testSemanticSearchE2E() {
	loggers.ai.info('🧪 Teste End-to-End: Busca Semântica\n');

	try {
		// 1. SETUP: Criar usuário de teste
		loggers.ai.info('📦 1. Criando usuário de teste...');
		const [user] = await db
			.insert(users)
			.values({ name: 'Test User E2E', email: `test-e2e-${Date.now()}@example.com` })
			.returning();

		await db.insert(authProviders).values({
			userId: user.id,
			provider: 'telegram',
			providerUserId: `test-${Date.now()}`,
		});

		loggers.ai.info(`✅ Usuário criado: ${user.id}\n`);

		// 2. SALVAR: Filmes variados
		loggers.ai.info('📦 2. Salvando filmes com embeddings...');

		const movies = [
			{
				title: 'Inception',
				description: 'Filme de ficção científica sobre infiltração em sonhos',
				type: 'movie' as const,
			},
			{
				title: 'Interstellar',
				description: 'Jornada espacial através de um buraco de minhoca',
				type: 'movie' as const,
			},
			{
				title: 'The Godfather',
				description: 'Drama sobre família mafiosa italiana',
				type: 'movie' as const,
			},
			{
				title: 'Fast & Furious',
				description: 'Ação com corridas de carros',
				type: 'movie' as const,
			},
		];

		for (const movie of movies) {
			await itemService.createItem({
				userId: user.id,
				type: movie.type,
				title: movie.title,
				metadata: { overview: movie.description } as any,
			});
			loggers.ai.info(`   ✅ ${movie.title} salvo com embedding`);
		}

		loggers.ai.info('\n📦 3. Executando buscas semânticas...\n');

		// 3. BUSCAR: Queries semânticas
		const searches = [
			{ query: 'filmes sobre sonhos', expected: 'Inception' },
			{ query: 'exploração espacial', expected: 'Interstellar' },
			{ query: 'máfia italiana', expected: 'The Godfather' },
			{ query: 'carros e velocidade', expected: 'Fast & Furious' },
		];

		for (const search of searches) {
			loggers.ai.info(`🔍 Query: "${search.query}"`);

			const results = await itemService.searchItems({
				userId: user.id,
				query: search.query,
				limit: 5,
			});

			if (results.length === 0) {
				loggers.ai.info('   ❌ Nenhum resultado encontrado\n');
				continue;
			}

			loggers.ai.info(`   📊 ${results.length} resultado(s):\n`);

			for (const [index, result] of results.entries()) {
				const similarity = (result as any).similarity;
				loggers.ai.info(`      ${index + 1}. ${result.title} - ${(similarity * 100).toFixed(1)}% similar`);
			}

			const topResult = results[0];
			if (topResult.title === search.expected) {
				loggers.ai.info('   ✅ Resultado esperado encontrado!\n');
			} else {
				loggers.ai.info(`   ⚠️ Resultado diferente do esperado (esperado: ${search.expected})\n`);
			}
		}

		// 4. CLEANUP
		loggers.ai.info('🧹 4. Limpando dados de teste...');
		await db.delete(memoryItems).where(eq(memoryItems.userId, user.id));
		await db.delete(authProviders).where(eq(authProviders.userId, user.id));
		await db.delete(users).where(eq(users.id, user.id));
		loggers.ai.info('✅ Dados removidos\n');

		loggers.ai.info('🎉 Teste E2E concluído com sucesso!');
		process.exit(0);
	} catch (error) {
		loggers.ai.error({ error }, '❌ Erro no teste E2E');
		process.exit(1);
	}
}

testSemanticSearchE2E();
