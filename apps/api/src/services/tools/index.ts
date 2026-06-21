/**
 * Tools com contratos fortes - v2
 *
 * Cada tool faz UMA coisa específica.
 * Entradas validadas, saídas previsíveis, zero decisão.
 */

import { PostgresProjectionStore } from '@/core/memory/projection-store';
import { conversationService } from '@/services/conversation-service';
import { getRandomLogMessage, toolLogs } from '@/services/conversation/logMessages';
import { enrichmentService } from '@/services/enrichment';
import { bookService } from '@/services/enrichment/book-service';
import { braveSearchService } from '@/services/enrichment/brave-search-service';
import { imageMetadataService } from '@/services/enrichment/image-metadata-service';
import { openGraphService } from '@/services/enrichment/opengraph-service';
import { spotifyService } from '@/services/enrichment/spotify-service';
import { itemService } from '@/services/item-service';
import type {
	BookMetadata,
	ImageMetadata,
	LinkMetadata,
	MemoryMetadata,
	MovieMetadata,
	MusicMetadata,
	NoteMetadata,
	TVShowMetadata,
	VideoMetadata,
} from '@/types';
import { loggers } from '@/utils/logger';
import { setAttributes, startSpan } from '@nexo/otel/tracing';

export interface ToolContext {
	userId: string;
	conversationId: string;
	provider?: 'telegram' | 'whatsapp' | 'discord';
	externalId?: string;
}

export interface ToolOutput {
	success: boolean;
	message?: string;
	data?: any;
	error?: string;
}

// ProjectionStore instance for writing memory envelopes (Path A)
const projectionStore = new PostgresProjectionStore();

// ============================================================================
// SAVE TOOLS - Contratos específicos por tipo
// ============================================================================

/**
 * Tool: save_note
 * Salva nota de texto
 */
export async function save_note(
	context: ToolContext,
	params: {
		content: string;
	},
): Promise<ToolOutput> {
	loggers.tools.info(`🔧 ${getRandomLogMessage(toolLogs.executing, { tool: 'save_note' })}`);
	loggers.tools.info(
		`📦 ${getRandomLogMessage(toolLogs.params, {
			params: JSON.stringify({ content: `${params.content?.substring(0, 100)}...` }),
		})}`,
	);

	if (!params.content?.trim()) {
		loggers.tools.error(
			`❌ ${getRandomLogMessage(toolLogs.error, {
				tool: 'save_note',
				error: 'Conteúdo vazio',
			})}`,
		);
		return { success: false, error: 'Conteúdo vazio' };
	}

	try {
		const metadata = {
			full_content: params.content,
			created_via: 'chat',
		} as NoteMetadata;

		// Verificar duplicata via ItemService (leitura ainda funciona)
		const dupCheck = await itemService.checkDuplicate({
			userId: context.userId,
			type: 'note',
			title: params.content.slice(0, 100),
			metadata,
		});

		if (dupCheck.isDuplicate && dupCheck.existingItem) {
			loggers.tools.warn('⚠️ Nota duplicada detectada');
			return {
				success: false,
				error: 'duplicate',
				message: `⚠️ Esta nota já foi salva em ${new Date(dupCheck.existingItem.createdAt).toLocaleDateString('pt-BR')}.`,
			};
		}

		const envelope = await projectionStore.writeEnvelope({
			userId: context.userId,
			sessionKey: context.conversationId,
			sourceKind: 'note',
			sourceChannel: context.provider,
			normalizedContent: params.content,
			rawArtifact: metadata,
			artifactMetadata: metadata as Record<string, unknown>,
			confidence: 1.0,
			relevanceDecay: null,
			audit: { created_via: 'chat', tool: 'save_note' },
		});

		if (!envelope) {
			loggers.tools.error(
				`❌ ${getRandomLogMessage(toolLogs.error, {
					tool: 'save_note',
					error: 'projectionStore.writeEnvelope retornou null',
				})}`,
			);
			loggers.tools.error({ envelope }, '❌ Erro ao criar nota no banco de dados');
			return {
				success: false,
				error: 'Erro ao criar nota no banco de dados',
			};
		}

		loggers.tools.info(`✅ ${getRandomLogMessage(toolLogs.success, { tool: 'save_note' })}`);
		loggers.tools.info({ id: envelope.id }, '📝 Nota salva');

		return {
			success: true,
			data: { id: envelope.id, title: params.content.slice(0, 100) },
		};
	} catch (error) {
		loggers.tools.error(
			{ err: error },
			`❌ ${getRandomLogMessage(toolLogs.error, {
				tool: 'save_note',
				error: error instanceof Error ? error.message : 'Erro desconhecido',
			})}`,
		);

		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao salvar nota',
		};
	}
}

/**
 * Tool: save_movie
 * Salva filme (com ou sem enriquecimento)
 * Se não tem tmdb_id, busca no TMDB e retorna candidatos para seleção
 * Se tem tmdb_id, salva imediatamente com dados básicos e dispara enriquecimento completo async
 */
export async function save_movie(
	context: ToolContext,
	params: {
		title: string;
		year?: number;
		tmdb_id?: number;
		rating?: number;
		genres?: string[];
		overview?: string;
		poster_path?: string | null;
	},
): Promise<ToolOutput> {
	if (!params.title?.trim()) {
		return { success: false, error: 'Título vazio' };
	}

	try {
		if (!params.tmdb_id) {
			loggers.tools.info(
				{ title: params.title, year: params.year },
				'🔍 save_movie sem tmdb_id → buscando candidatos no TMDB',
			);
			const results = await enrichmentService.searchMovies(params.title, params.year);

			if (results && results.length > 0) {
				return {
					success: true,
					data: {
						results: results.map((r) => ({
							type: 'movie' as const,
							title: r.title,
							year: r.release_date ? Number.parseInt(r.release_date.split('-')[0]) : undefined,
							tmdb_id: r.id,
							rating: r.vote_average || 0,
							overview: r.overview || '',
							poster_path: r.poster_path,
						})),
					},
				};
			}

			loggers.tools.warn({ title: params.title }, '⚠️ TMDB sem resultados, salvando filme sem enriquecimento');
		}

		const metadata: MovieMetadata = {
			tmdb_id: params.tmdb_id || 0,
			year: params.year || new Date().getFullYear(),
			genres: params.genres || [],
			rating: params.rating || 0,
			...(params.overview && { overview: params.overview }),
			...(params.poster_path && { poster_path: params.poster_path }),
		} as MovieMetadata;

		if (params.tmdb_id) {
			void enrichmentService
				.enrich('movie', { tmdbId: params.tmdb_id })
				.catch((err) =>
					loggers.tools.warn({ err, tmdb_id: params.tmdb_id }, '⚠️ Enrichment async falhou (não crítico)'),
				);
		}

		const envelope = await projectionStore.writeEnvelope({
			userId: context.userId,
			sessionKey: context.conversationId,
			sourceKind: 'movie',
			sourceChannel: context.provider,
			normalizedContent: params.title,
			rawArtifact: metadata,
			artifactMetadata: metadata as Record<string, unknown>,
			confidence: 1.0,
			relevanceDecay: null,
			audit: { created_via: 'chat', tool: 'save_movie' },
		});

		return {
			success: true,
			data: { id: envelope?.id, title: params.title },
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao salvar filme',
		};
	}
}

/**
 * Tool: save_tv_show
 * Salva série
 */
export async function save_tv_show(
	context: ToolContext,
	params: {
		title: string;
		year?: number;
		tmdb_id?: number;
		rating?: number;
		genres?: string[];
		overview?: string;
		poster_path?: string | null;
	},
): Promise<ToolOutput> {
	if (!params.title?.trim()) {
		return { success: false, error: 'Título vazio' };
	}

	try {
		if (!params.tmdb_id) {
			loggers.tools.info({ title: params.title }, '🔍 save_tv_show sem tmdb_id → buscando candidatos no TMDB');
			const results = await enrichmentService.searchTVShows(params.title);

			if (results && results.length > 0) {
				return {
					success: true,
					data: {
						results: results.map((r) => ({
							type: 'tv_show' as const,
							title: r.name,
							year: r.first_air_date,
							tmdb_id: r.id,
							rating: r.rating,
							overview: r.overview,
							poster_path: r.poster_path,
						})),
					},
				};
			}

			loggers.tools.warn({ title: params.title }, '⚠️ TMDB sem resultados, salvando série sem enriquecimento');
		}

		const metadata: TVShowMetadata = {
			tmdb_id: params.tmdb_id || 0,
			first_air_date: params.year || new Date().getFullYear(),
			number_of_seasons: 0,
			number_of_episodes: 0,
			status: 'Unknown',
			genres: params.genres || [],
			rating: params.rating || 0,
			...(params.overview && { overview: params.overview }),
			...(params.poster_path && { poster_path: params.poster_path }),
		} as TVShowMetadata;

		if (params.tmdb_id) {
			void enrichmentService
				.enrich('tv_show', { tmdbId: params.tmdb_id })
				.catch((err) =>
					loggers.tools.warn({ err, tmdb_id: params.tmdb_id }, '⚠️ Enrichment async falhou (não crítico)'),
				);
		}

		const envelope = await projectionStore.writeEnvelope({
			userId: context.userId,
			sessionKey: context.conversationId,
			sourceKind: 'tv_show',
			sourceChannel: context.provider,
			normalizedContent: params.title,
			rawArtifact: metadata,
			artifactMetadata: metadata as Record<string, unknown>,
			confidence: 1.0,
			relevanceDecay: null,
			audit: { created_via: 'chat', tool: 'save_tv_show' },
		});

		return {
			success: true,
			data: { id: envelope?.id, title: params.title },
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao salvar série',
		};
	}
}

/**
 * Tool: save_video
 * Salva vídeo (YouTube etc)
 */
export async function save_video(
	context: ToolContext,
	params: {
		url: string;
		title?: string;
	},
): Promise<ToolOutput> {
	if (!params.url?.trim()) {
		return { success: false, error: 'URL vazia' };
	}

	try {
		const metadata = {
			video_id: params.url,
			platform: 'youtube',
			channel_name: '',
			duration: 0,
		} as VideoMetadata;

		const envelope = await projectionStore.writeEnvelope({
			userId: context.userId,
			sessionKey: context.conversationId,
			sourceKind: 'video',
			sourceChannel: context.provider,
			normalizedContent: params.title || params.url,
			rawArtifact: metadata,
			artifactMetadata: metadata as Record<string, unknown>,
			confidence: 1.0,
			relevanceDecay: null,
			audit: { created_via: 'chat', tool: 'save_video' },
		});

		return {
			success: true,
			data: { id: envelope?.id, title: params.title || params.url },
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao salvar vídeo',
		};
	}
}

/**
 * Tool: save_link
 * Salva link genérico
 */
export async function save_link(
	context: ToolContext,
	params: {
		url: string;
		description?: string;
	},
): Promise<ToolOutput> {
	if (!params.url?.trim()) {
		return { success: false, error: 'URL vazia' };
	}

	try {
		const metadata = {
			url: params.url,
			og_description: params.description,
		} as LinkMetadata;

		const envelope = await projectionStore.writeEnvelope({
			userId: context.userId,
			sessionKey: context.conversationId,
			sourceKind: 'link',
			sourceChannel: context.provider,
			normalizedContent: params.description || params.url,
			rawArtifact: metadata,
			artifactMetadata: metadata as Record<string, unknown>,
			confidence: 1.0,
			relevanceDecay: null,
			audit: { created_via: 'chat', tool: 'save_link' },
		});

		return {
			success: true,
			data: { id: envelope?.id, title: params.description || params.url },
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao salvar link',
		};
	}
}
