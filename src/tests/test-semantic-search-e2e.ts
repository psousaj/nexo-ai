/**
 * Test: Semantic Search End-to-End
 *
 * Testa o fluxo completo:
 * 1. Criar usuário
 * 2. Salvar filmes com embeddings
 * 3. Buscar semanticamente
 * 4. Verificar resultados
 */

import { db } from '@/db';
import { users, userAccounts, memoryItems } from '@/db/schema';
import { itemService } from '@/services/item-service';
import { loggers } from '@/utils/logger';
import { eq } from 'drizzle-orm';

async function testSemanticSearchE2E() {
	console.log('🧪 Teste End-to-End: Busca Semântica\n');

	try {
		// 1. SETUP: Criar usuário de teste
		console.log('📦 1. Criando usuário de teste...');
		const [user] = await db
			.insert(users)
			.values({ name: 'Test User E2E', email: `test-e2e-${Date.now()}@example.com` })
			.returning();

		await db.insert(userAccounts).values({
			userId: user.id,
			provider: 'telegram',
			externalId: `test-${Date.now()}`,
		});

		console.log(`✅ Usuário criado: ${user.id}\n`);

		// 2. SALVAR: Filmes variados
		console.log('📦 2. Salvando filmes com embeddings...');

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
				description: movie.description,
			});
			console.log(`   ✅ ${movie.title} salvo com embedding`);
		}

		console.log('\n📦 3. Executando buscas semânticas...\n');

		// 3. BUSCAR: Queries semânticas
		const searches = [
			{ query: 'filmes sobre sonhos', expected: 'Inception' },
			{ query: 'exploração espacial', expected: 'Interstellar' },
			{ query: 'máfia italiana', expected: 'The Godfather' },
			{ query: 'carros e velocidade', expected: 'Fast & Furious' },
		];

		for (const search of searches) {
			console.log(`🔍 Query: "${search.query}"`);

			const results = await itemService.searchItems({
				userId: user.id,
				query: search.query,
				limit: 5,
			});

			if (results.length === 0) {
				console.log(`   ❌ Nenhum resultado encontrado\n`);
				continue;
			}

			console.log(`   📊 ${results.length} resultado(s):\n`);

			for (const [index, result] of results.entries()) {
				const similarity = (result as any).similarity;
				console.log(`      ${index + 1}. ${result.title} - ${(similarity * 100).toFixed(1)}% similar`);
			}

			const topResult = results[0];
			if (topResult.title === search.expected) {
				console.log(`   ✅ Resultado esperado encontrado!\n`);
			} else {
				console.log(`   ⚠️ Resultado diferente do esperado (esperado: ${search.expected})\n`);
			}
		}

		// 4. CLEANUP
		console.log('🧹 4. Limpando dados de teste...');
		await db.delete(memoryItems).where(eq(memoryItems.userId, user.id));
		await db.delete(userAccounts).where(eq(userAccounts.userId, user.id));
		await db.delete(users).where(eq(users.id, user.id));
		console.log('✅ Dados removidos\n');

		console.log('🎉 Teste E2E concluído com sucesso!');
		process.exit(0);
	} catch (error) {
		console.error('❌ Erro no teste E2E:', error);
		process.exit(1);
	}
}

testSemanticSearchE2E();
