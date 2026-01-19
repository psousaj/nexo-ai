import { db } from '@/db';
import { memoryItems } from '@/db/schema';
import { eq, and, desc, sql, or, inArray } from 'drizzle-orm';
import { loggers } from '@/utils/logger';
import type { ItemType, ItemMetadata, MovieMetadata, TVShowMetadata } from '@/types/index';
import { createHash } from 'crypto';
import { embeddingService } from './ai/embedding-service';
import { cosineSimilarity } from 'ai';
import { expandMovieQuery } from './query-expansion';

/**
 * Resultado da verificação de duplicata
 */
export interface DuplicateCheckResult {
	isDuplicate: boolean;
	existingItem?: {
		id: string;
		title: string;
		type: ItemType;
		createdAt: Date;
	};
}

export class ItemService {
	/**
	 * Verifica se memória já existe (KISS: verificação simples por externalId ou título)
	 */
	async checkDuplicate(params: {
		userId: string;
		type: ItemType;
		externalId?: string;
		title?: string;
		contentHash?: string;
		metadata?: ItemMetadata;
	}): Promise<DuplicateCheckResult> {
		const { userId, type, externalId, title, metadata } = params;

		// Gera hash do conteúdo
		const contentHash = this.generateContentHash({ type, title: title || '', metadata });

		// 1. Verifica por contentHash (mais preciso)
		if (contentHash) {
			const [existing] = await db
				.select()
				.from(memoryItems)
				.where(and(eq(memoryItems.userId, userId), eq(memoryItems.contentHash, contentHash)))
				.limit(1);

			if (existing) {
				return {
					isDuplicate: true,
					existingItem: {
						id: existing.id,
						title: existing.title,
						type: existing.type as ItemType,
						createdAt: existing.createdAt,
					},
				};
			}
		}

		// 2. Verifica por externalId (fallback)
		if (externalId) {
			const [existing] = await db
				.select()
				.from(memoryItems)
				.where(and(eq(memoryItems.userId, userId), eq(memoryItems.type, type), eq(memoryItems.externalId, externalId)))
				.limit(1);

			if (existing) {
				return {
					isDuplicate: true,
					existingItem: {
						id: existing.id,
						title: existing.title,
						type: existing.type as ItemType,
						createdAt: existing.createdAt,
					},
				};
			}
		}

		// Fallback: busca por título similar (normalizado)
		if (title) {
			const normalizedTitle = this.normalizeTitle(title);
			const [existing] = await db
				.select()
				.from(memoryItems)
				.where(
					and(
						eq(memoryItems.userId, userId),
						eq(memoryItems.type, type),
						sql`LOWER(REGEXP_REPLACE(${memoryItems.title}, '[^a-zA-Z0-9]', '', 'g')) = ${normalizedTitle}`,
					),
				)
				.limit(1);

			if (existing) {
				return {
					isDuplicate: true,
					existingItem: {
						id: existing.id,
						title: existing.title,
						type: existing.type as ItemType,
						createdAt: existing.createdAt,
					},
				};
			}
		}

		return { isDuplicate: false };
	}

	/**
	 * Normaliza título para comparação (remove caracteres especiais, lowercase)
	 */
	private normalizeTitle(title: string): string {
		return title.toLowerCase().replace(/[^a-z0-9]/g, '');
	}

	/**
	 * Gera hash SHA-256 do conteúdo para detectar duplicatas
	 * Combina: tipo + título + metadata relevante
	 */
	private generateContentHash(params: { type: ItemType; title: string; metadata?: ItemMetadata }): string {
		const { type, title, metadata } = params;

		// Normaliza conteúdo para hash consistente
		const normalizedTitle = title.toLowerCase().trim();

		// Extrai campos relevantes do metadata baseado no tipo
		let contentToHash = `${type}:${normalizedTitle}`;

		if (metadata) {
			switch (type) {
				case 'movie':
				case 'tv_show':
					const tmdbId = (metadata as any).tmdb_id;
					if (tmdbId) contentToHash += `:tmdb_${tmdbId}`;
					break;
				case 'video':
					const videoId = (metadata as any).video_id;
					if (videoId) contentToHash += `:video_${videoId}`;
					break;
				case 'link':
					const url = (metadata as any).url;
					if (url) {
						const normalizedUrl = url.replace(/^https?:\/\/(www\.)?/, '').toLowerCase();
						contentToHash += `:url_${normalizedUrl}`;
					}
					break;
				case 'note':
					const fullContent = (metadata as any).full_content;
					if (fullContent) {
						// Para notas, usa o conteúdo completo
						contentToHash = `${type}:${fullContent.toLowerCase().trim()}`;
					}
					break;
			}
		}

		// Gera SHA-256 hash
		return createHash('sha256').update(contentToHash).digest('hex');
	}

	/**
	 * Extrai externalId do metadata baseado no tipo
	 */
	private extractExternalId(type: ItemType, metadata?: ItemMetadata): string | undefined {
		if (!metadata) return undefined;

		switch (type) {
			case 'movie':
			case 'tv_show':
				return (metadata as any).tmdb_id?.toString();
			case 'video':
				return (metadata as any).video_id;
			case 'link':
				// Normaliza URL removendo protocolo e www
				const url = (metadata as any).url;
				return url?.replace(/^https?:\/\/(www\.)?/, '').toLowerCase();
			default:
				return undefined;
		}
	}

	/**
	 * 🔥 Prepara documento semântico ENRIQUECIDO para embedding
	 *
	 * Estratégia: Concatena campos CRÍTICOS para busca semântica
	 * - Keywords TMDB (ouro puro)
	 * - Overview/Sinopse (contexto rico)
	 * - Tagline (frase de efeito)
	 * - Gêneros
	 * - Elenco/Diretor (contexto adicional)
	 *
	 * Referência: ADR-014 (Document Enrichment Strategy)
	 */
	private prepareTextForEmbedding(params: { type: ItemType; title: string; metadata?: ItemMetadata }): string {
		const { type, title, metadata } = params;

		// Base: tipo + título
		let text = `Título: ${title}.`;

		if (!metadata) {
			return text;
		}

		// 🎬 FILMES E SÉRIES (usa TMDB enrichment)
		if (type === 'movie' || type === 'tv_show') {
			const tmdbMeta = metadata as MovieMetadata | TVShowMetadata;

			// 🔥 KEYWORDS (CRÍTICO - maior peso semântico)
			if (tmdbMeta.keywords && tmdbMeta.keywords.length > 0) {
				text += ` Palavras-chave: ${tmdbMeta.keywords.join(', ')}.`;
			}

			// 📝 OVERVIEW (sinopse - contexto rico)
			if (tmdbMeta.overview) {
				text += ` Sinopse: ${tmdbMeta.overview}.`;
			}

			// 💬 TAGLINE (frase de efeito)
			if (tmdbMeta.tagline) {
				text += ` Tagline: ${tmdbMeta.tagline}.`;
			}

			// 🎭 GÊNEROS (importante para categorização)
			if (tmdbMeta.genres && tmdbMeta.genres.length > 0) {
				text += ` Gêneros: ${tmdbMeta.genres.join(', ')}.`;
			}

			// 🎬 DIRETOR/CRIADOR (contexto adicional)
			if ('director' in tmdbMeta && tmdbMeta.director) {
				text += ` Diretor: ${tmdbMeta.director}.`;
			} else if ('created_by' in tmdbMeta && tmdbMeta.created_by && tmdbMeta.created_by.length > 0) {
				text += ` Criador: ${tmdbMeta.created_by.join(', ')}.`;
			}

			// 👥 ELENCO (top 3 para não poluir)
			if (tmdbMeta.cast && tmdbMeta.cast.length > 0) {
				const mainCast = tmdbMeta.cast.slice(0, 3);
				text += ` Elenco: ${mainCast.join(', ')}.`;
			}
		}
		// 📺 VÍDEOS (YouTube/Vimeo)
		else if (type === 'video') {
			const videoMeta = metadata as any;
			if (videoMeta.channel_name) {
				text += ` Canal: ${videoMeta.channel_name}.`;
			}
		}
		// 🔗 LINKS (OpenGraph)
		else if (type === 'link') {
			const linkMeta = metadata as any;
			if (linkMeta.og_description) {
				text += ` Descrição: ${linkMeta.og_description}.`;
			}
			if (linkMeta.domain) {
				text += ` Domínio: ${linkMeta.domain}.`;
			}
		}
		// 📝 NOTAS (conteúdo completo)
		else if (type === 'note') {
			const noteMeta = metadata as any;
			if (noteMeta.full_content) {
				text += ` Conteúdo: ${noteMeta.full_content}`;
			}
		}

		loggers.db.debug({ textLength: text.length, type, hasKeywords: !!(metadata as any).keywords }, '📝 Documento semântico preparado');

		return text;
	}

	/**
	 * Cria nova memória (com validação de duplicata)
	 * Retorna { item, isDuplicate, existingItem }
	 */
	async createItem(params: {
		userId: string;
		type: ItemType;
		title: string;
		metadata?: ItemMetadata;
		skipDuplicateCheck?: boolean;
	}): Promise<{
		item: any;
		isDuplicate: boolean;
		existingItem?: DuplicateCheckResult['existingItem'];
	}> {
		const { userId, type, title, metadata, skipDuplicateCheck = false } = params;

		// Extrai externalId do metadata
		const externalId = this.extractExternalId(type, metadata);

		// Gera hash do conteúdo
		const contentHash = this.generateContentHash({ type, title, metadata });

		// Valida duplicata (DRY: reutiliza checkDuplicate)
		if (!skipDuplicateCheck) {
			const duplicateCheck = await this.checkDuplicate({
				userId,
				type,
				externalId,
				title,
				contentHash,
				metadata,
			});

			if (duplicateCheck.isDuplicate) {
				return {
					item: null,
					isDuplicate: true,
					existingItem: duplicateCheck.existingItem,
				};
			}
		}

		// Gera embedding semântico
		let embedding: number[] | null = null;
		try {
			const textToEmbed = this.prepareTextForEmbedding({ type, title, metadata });
			embedding = await embeddingService.generateEmbedding(textToEmbed);
			loggers.db.info({ title: title.substring(0, 30) }, '✨ Vetor gerado');
		} catch (error) {
			loggers.db.warn({ err: error }, '⚠️ Falha ao gerar embedding, salvando sem vetor');
		}

		// Cria nova memória
		const [item] = await db
			.insert(memoryItems)
			.values({
				userId,
				type,
				title,
				externalId,
				contentHash,
				metadata,
				embedding,
			})
			.returning();

		return { item, isDuplicate: false };
	}

	/**
	 * Lista memórias do usuário
	 */
	async listItems(params: { userId: string; type?: ItemType; limit?: number }) {
		const { userId, type, limit = 20 } = params;

		const conditions = [eq(memoryItems.userId, userId)];
		if (type) {
			conditions.push(eq(memoryItems.type, type));
		}

		return await db
			.select()
			.from(memoryItems)
			.where(and(...conditions))
			.orderBy(desc(memoryItems.createdAt))
			.limit(limit);
	}

	/**
	 * Busca memória por ID
	 */
	async getItemById(itemId: string, userId: string) {
		const [item] = await db
			.select()
			.from(memoryItems)
			.where(and(eq(memoryItems.id, itemId), eq(memoryItems.userId, userId)))
			.limit(1);

		return item;
	}

	/**
	 * Busca semântica
	 */
	/**
	 * Busca semântica (Hybrid Search: Vector + Keyword)
	 * Usa cosineSimilarity da biblioteca 'ai' para cálculo preciso
	 * + Query Expansion para melhorar recall
	 */
	async searchItems(params: { userId: string; query: string; limit?: number }) {
		const { userId, query, limit = 10 } = params;
		const searchPattern = `%${query}%`;

		try {
			// 🔥 QUERY EXPANSION (adiciona termos relacionados)
			const expandedQuery = expandMovieQuery(query);
			loggers.db.debug({ original: query, expanded: expandedQuery.substring(0, 100) }, '🔍 Query expandida');

			// 1. BUSCA VETORIAL (Semântica)
			const queryEmbedding = await embeddingService.generateEmbedding(expandedQuery);

			// Busca todos os itens com embedding
			const itemsWithEmbedding = await db
				.select({
					id: memoryItems.id,
					title: memoryItems.title,
					type: memoryItems.type,
					metadata: memoryItems.metadata,
					embedding: memoryItems.embedding,
					createdAt: memoryItems.createdAt,
				})
				.from(memoryItems)
				.where(and(eq(memoryItems.userId, userId), sql`${memoryItems.embedding} IS NOT NULL`));

			if (itemsWithEmbedding.length === 0) {
				loggers.db.warn('Nenhum item com embedding encontrado');
				throw new Error('No embeddings available');
			}

			// Calcula similaridade usando biblioteca 'ai' (battle-tested)
			const itemsWithSimilarity = itemsWithEmbedding.map((item) => {
				const similarity = cosineSimilarity(queryEmbedding, item.embedding as number[]);
				return {
					...item,
					similarity,
				};
			});

			// Filtra por threshold e ordena por similaridade
			const SIMILARITY_THRESHOLD = 0.3; // 30% de similaridade mínima
			const vectorResults = itemsWithSimilarity
				.filter((item) => item.similarity > SIMILARITY_THRESHOLD)
				.sort((a, b) => b.similarity - a.similarity)
				.slice(0, limit);

			if (vectorResults.length > 0) {
				loggers.db.info(
					{
						count: vectorResults.length,
						topSimilarity: vectorResults[0].similarity.toFixed(3),
					},
					'🔍 Busca semântica bem-sucedida',
				);
				return vectorResults;
			}
		} catch (error) {
			loggers.db.warn({ err: error }, '⚠️ Falha na busca vetorial, usando fallback literal');
		}

		// 2. FALLBACK: BUSCA KEYWORD (Literal)
		loggers.db.info({ query }, '📜 Usando busca literal');
		return await db
			.select()
			.from(memoryItems)
			.where(
				and(
					eq(memoryItems.userId, userId),
					or(
						sql`LOWER(${memoryItems.title}) LIKE LOWER(${searchPattern})`,
						sql`CAST(${memoryItems.metadata} AS TEXT) ILIKE ${searchPattern}`,
					),
				),
			)
			.orderBy(desc(memoryItems.createdAt))
			.limit(limit);
	}

	/**
	 * Busca avançada com filtros JSONB
	 * @param params - Filtros de busca
	 * @param params.yearRange - Filtra por range de ano [min, max]
	 * @param params.hasStreaming - true = apenas com streaming, false = sem streaming
	 * @param params.minRating - Rating mínimo (0-10)
	 * @param params.genres - Array de gêneros para filtrar
	 * @param params.orderBy - Campo para ordenação: 'created' | 'rating' | 'year'
	 */
	async advancedSearch(params: {
		userId: string;
		query?: string;
		type?: ItemType;
		yearRange?: [number, number];
		hasStreaming?: boolean;
		minRating?: number;
		genres?: string[];
		orderBy?: 'created' | 'rating' | 'year';
		limit?: number;
	}) {
		const { userId, query, type, yearRange, hasStreaming, minRating, genres, orderBy = 'created', limit = 20 } = params;

		const conditions = [eq(memoryItems.userId, userId)];

		// Filtro por tipo
		if (type) {
			conditions.push(eq(memoryItems.type, type));
		}

		// Filtro por query (full-text search em título)
		if (query) {
			conditions.push(sql`LOWER(${memoryItems.title}) LIKE LOWER(${'%' + query + '%'})`);
		}

		// Filtro por ano (movies/tv_shows)
		if (yearRange) {
			const [minYear, maxYear] = yearRange;
			conditions.push(
				sql`(
          (${memoryItems.type} = 'movie' AND 
           (${memoryItems.metadata}->>'year')::int BETWEEN ${minYear} AND ${maxYear})
          OR 
          (${memoryItems.type} = 'tv_show' AND 
           (${memoryItems.metadata}->>'first_air_date')::int BETWEEN ${minYear} AND ${maxYear})
        )`,
			);
		}

		// Filtro por streaming disponível
		if (hasStreaming !== undefined) {
			if (hasStreaming) {
				conditions.push(
					sql`${memoryItems.metadata}->'streaming' IS NOT NULL AND 
              jsonb_array_length(${memoryItems.metadata}->'streaming') > 0`,
				);
			} else {
				conditions.push(
					sql`(${memoryItems.metadata}->'streaming' IS NULL OR 
               jsonb_array_length(${memoryItems.metadata}->'streaming') = 0)`,
				);
			}
		}

		// Filtro por rating mínimo
		if (minRating !== undefined) {
			conditions.push(sql`(${memoryItems.metadata}->>'rating')::float >= ${minRating}`);
		}

		// Filtro por gêneros (OR: item tem pelo menos um dos gêneros)
		if (genres && genres.length > 0) {
			const genreConditions = genres.map((genre) => sql`${memoryItems.metadata}->'genres' @> ${JSON.stringify([genre])}`);
			conditions.push(or(...genreConditions)!);
		}

		// Ordenação
		let orderClause;
		switch (orderBy) {
			case 'rating':
				orderClause = sql`(${memoryItems.metadata}->>'rating')::float DESC NULLS LAST`;
				break;
			case 'year':
				orderClause = sql`COALESCE(
          (${memoryItems.metadata}->>'year')::int,
          (${memoryItems.metadata}->>'first_air_date')::int
        ) DESC NULLS LAST`;
				break;
			default:
				orderClause = desc(memoryItems.createdAt);
		}

		return await db
			.select()
			.from(memoryItems)
			.where(and(...conditions))
			.orderBy(orderClause)
			.limit(limit);
	}

	/**
	 * Wrapper para buscar memórias do usuário (compatível com tool calling)
	 */
	async getUserItems(userId: string, query?: string, type?: string, limit: number = 10) {
		if (query) {
			return this.searchItems({ userId, query, limit });
		}

		return this.listItems({
			userId,
			type: type as ItemType | undefined,
			limit,
		});
	}

	/**
	 * Deleta memória
	 */
	async deleteItem(itemId: string, userId: string) {
		await db.delete(memoryItems).where(and(eq(memoryItems.id, itemId), eq(memoryItems.userId, userId)));
	}

	/**
	 * Deleta múltiplos itens
	 */
	async deleteMultipleItems(itemIds: string[], userId: string): Promise<number> {
		if (itemIds.length === 0) return 0;

		const result = await db
			.delete(memoryItems)
			.where(and(eq(memoryItems.userId, userId), inArray(memoryItems.id, itemIds)))
			.returning();

		return result.length;
	}

	/**
	 * Deleta TODOS os itens do usuário
	 */
	async deleteAllItems(userId: string): Promise<number> {
		const result = await db.delete(memoryItems).where(eq(memoryItems.userId, userId)).returning();

		return result.length;
	}
}

export const itemService = new ItemService();
