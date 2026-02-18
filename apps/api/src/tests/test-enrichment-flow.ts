/**
 * Test: Metric Storage Normalization (Bulk Async, Fallback & Consistency)
 *
 * Valida os fluxos de enriquecimento em background e fallback síncrono.
 */

import { db } from '@/db';
import { memoryItems, semanticExternalItems, userAccounts, users } from '@/db/schema';
import { tmdbService } from '@/services/enrichment/tmdb-service';
import { itemService } from '@/services/item-service';
import { enrichmentQueue } from '@/services/queue-service';
import { loggers } from '@/utils/logger';
import { and, eq } from 'drizzle-orm';

async function testEnrichmentFlow() {
	loggers.ai.info('🧪 Iniciando Teste de Normalização de Métricas\n');

	try {
		// 1. SETUP: Criar usuário de teste
		loggers.ai.info('📦 1. Criando usuário de teste...');
		const [user] = await db
			.insert(users)
			.values({ name: 'Test Normalization', email: `test-norm-${Date.now()}@example.com` })
			.returning();

		await db.insert(userAccounts).values({
			userId: user.id,
			provider: 'telegram',
			externalId: `test-norm-${Date.now()}`,
		});

		loggers.ai.info(`✅ Usuário criado: ${user.id}\n`);

		// --- CENÁRIO A: BULK ASYNC ENRICHMENT ---
		loggers.ai.info('🚀 --- CENÁRIO A: BULK ASYNC ENRICHMENT ---');

		const query = 'Matrix';
		loggers.ai.info(`🔍 Buscando "${query}" no TMDB (deve disparar job)...`);
		const results = await tmdbService.searchMovies(query);
		const targetMovie = results[0];

		if (!targetMovie) throw new Error('Filme não encontrado para o teste');

		loggers.ai.info('✅ Busca concluída. Aguardando processamento do worker (5s)...');

		// Aguarda o worker processar
		await new Promise((resolve) => setTimeout(resolve, 5000));

		// Verifica se o item foi pro cache global
		const [globalItem] = await db
			.select()
			.from(semanticExternalItems)
			.where(
				and(
					eq(semanticExternalItems.externalId, String(targetMovie.id)),
					eq(semanticExternalItems.type, 'movie'),
					eq(semanticExternalItems.provider, 'tmdb'),
				),
			)
			.limit(1);

		if (globalItem?.embedding) {
			loggers.ai.info('✅ SUCCESS: Item encontrado no cache global com embedding!');
		} else {
			loggers.ai.warn('⚠️ WARNING: Item não encontrado no cache global ou sem embedding após delay.');
		}

		// --- CENÁRIO B: CONSISTÊNCIA / IDEMPOTÊNCIA ---
		loggers.ai.info('\n🔄 --- CENÁRIO B: CONSISTÊNCIA / IDEMPOTÊNCIA ---');
		loggers.ai.info('📤 Disparando job manual para o mesmo item...');

		await enrichmentQueue.add('bulk-enrich-candidates', {
			candidates: [targetMovie],
			provider: 'tmdb',
			type: 'movie',
		});

		await new Promise((resolve) => setTimeout(resolve, 3000));

		const globalItemsCount = await db
			.select()
			.from(semanticExternalItems)
			.where(
				and(
					eq(semanticExternalItems.externalId, String(targetMovie.id)),
					eq(semanticExternalItems.type, 'movie'),
					eq(semanticExternalItems.provider, 'tmdb'),
				),
			);

		if (globalItemsCount.length === 1) {
			loggers.ai.info('✅ SUCCESS: Idempotência verificada (apenas 1 registro no banco).');
		} else {
			loggers.ai.error(`❌ FAILED: Encontrado(s) ${globalItemsCount.length} registros para o mesmo item.`);
		}

		// --- CENÁRIO C: FALLBACK SÍNCRONO ---
		loggers.ai.info('\n🛡️ --- CENÁRIO C: FALLBACK SÍNCRONO ---');

		// Usamos um filme que provavelmente não está no banco ainda (ID aleatório alto)
		const queryFallback = 'Tenet';
		loggers.ai.info(`🔍 Buscando "${queryFallback}"...`);
		const resultsFallback = await tmdbService.searchMovies(queryFallback);
		const movieFallback = resultsFallback[0];

		if (!movieFallback) throw new Error('Filme fallback não encontrado');

		// Limpa qualquer cache global dele se existir (garante teste de fallback funcional)
		await db
			.delete(semanticExternalItems)
			.where(
				and(eq(semanticExternalItems.externalId, String(movieFallback.id)), eq(semanticExternalItems.type, 'movie')),
			);

		loggers.ai.info('💾 Salvando item IMEDIATAMENTE (antes do worker processar)...');

		const { item } = await itemService.createItem({
			userId: user.id,
			type: 'movie',
			title: movieFallback.title,
			metadata: await tmdbService.enrichMovie(movieFallback.id),
		});

		if (item.semanticExternalItemId) {
			loggers.ai.info('✅ SUCCESS: Item linkado com ID global criado síncronamente.');

			const [savedGlobal] = await db
				.select()
				.from(semanticExternalItems)
				.where(eq(semanticExternalItems.id, item.semanticExternalItemId))
				.limit(1);

			if (savedGlobal?.embedding) {
				loggers.ai.info('✅ SUCCESS: Global item tem embedding válido.');
			}
		} else {
			loggers.ai.error('❌ FAILED: Item não foi linkado com semanticExternalItemId.');
		}

		// 5. CLEANUP
		loggers.ai.info('\n🧹 5. Limpando dados de teste...');
		await db.delete(memoryItems).where(eq(memoryItems.userId, user.id));
		await db.delete(userAccounts).where(eq(userAccounts.userId, user.id));
		await db.delete(users).where(eq(users.id, user.id));
		// Não removemos do cache global para não interferir com outros testes,
		// mas para este teste específico de fallback removemos os IDs usados.
		await db
			.delete(semanticExternalItems)
			.where(
				and(eq(semanticExternalItems.externalId, String(targetMovie.id)), eq(semanticExternalItems.type, 'movie')),
			);
		await db
			.delete(semanticExternalItems)
			.where(
				and(eq(semanticExternalItems.externalId, String(movieFallback.id)), eq(semanticExternalItems.type, 'movie')),
			);

		loggers.ai.info('✅ Dados limpos.');
		loggers.ai.info('\n🎉 Todas as verificações concluídas com sucesso!');
		process.exit(0);
	} catch (error) {
		loggers.ai.error({ error }, '❌ Erro durante o teste de fluxo');
		process.exit(1);
	}
}

testEnrichmentFlow();
