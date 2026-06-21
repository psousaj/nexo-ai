// ============================================================================
// SAVE BOOK
// ============================================================================

/**
 * Tool: save_book
 */
export async function save_book(
	context: ToolContext,
	params: {
		title: string;
		author?: string;
		year?: number;
		google_books_id?: string;
		isbn?: string;
		cover_url?: string;
		publisher?: string;
		page_count?: number;
		genres?: string[];
		description?: string;
	},
): Promise<ToolOutput> {
	if (!params.title?.trim()) {
		return { success: false, error: 'Título vazio' };
	}

	try {
		if (params.google_books_id) {
			const metadata: BookMetadata = {
				title: params.title,
				authors: params.author ? [params.author] : [],
				year: params.year,
				publisher: params.publisher,
				page_count: params.page_count,
				genres: params.genres ?? [],
				description: params.description,
				cover_url: params.cover_url,
				isbn: params.isbn,
				google_books_id: params.google_books_id,
			};

			const dupCheck = await itemService.checkDuplicate({
				userId: context.userId,
				type: 'book',
				title: params.title,
				externalId: params.google_books_id,
				metadata,
			});

			if (dupCheck.isDuplicate && dupCheck.existingItem) {
				return {
					success: false,
					error: 'duplicate',
					message: `⚠️ Este livro já foi salvo em ${new Date(dupCheck.existingItem.createdAt).toLocaleDateString('pt-BR')}.`,
				};
			}

			const envelope = await projectionStore.writeEnvelope({
				userId: context.userId,
				sessionKey: context.conversationId,
				sourceKind: 'book',
				sourceChannel: context.provider,
				normalizedContent: params.title,
				rawArtifact: metadata,
				artifactMetadata: metadata as Record<string, unknown>,
				confidence: 1.0,
				relevanceDecay: null,
				audit: { created_via: 'chat', tool: 'save_book' },
			});

			return {
				success: true,
				data: { id: envelope?.id, title: params.title },
			};
		}

		const found = await bookService.searchBook(params.title, params.author);

		if (!found) {
			loggers.tools.warn({ title: params.title }, '⚠️ Google Books sem resultado, salvando livro sem metadata');
			const fallbackMetadata = {
				title: params.title,
				authors: params.author ? [params.author] : [],
				genres: [],
				google_books_id: `manual:${params.title.toLowerCase().trim().replace(/\s+/g, '-')}`,
			} as BookMetadata;

			const envelope = await projectionStore.writeEnvelope({
				userId: context.userId,
				sessionKey: context.conversationId,
				sourceKind: 'book',
				sourceChannel: context.provider,
				normalizedContent: params.title,
				rawArtifact: fallbackMetadata,
				artifactMetadata: fallbackMetadata as Record<string, unknown>,
				confidence: 1.0,
				relevanceDecay: null,
				audit: { created_via: 'chat', tool: 'save_book' },
			});
			return {
				success: true,
				data: { id: envelope?.id, title: params.title },
			};
		}

		return {
			success: true,
			data: {
				results: [{
					type: 'book' as const,
					title: found.title,
					author: found.authors?.[0],
					year: found.year,
					cover_url: found.cover_url,
					description: found.description,
					google_books_id: found.google_books_id,
					isbn: found.isbn,
					publisher: found.publisher,
					page_count: found.page_count,
					genres: found.genres,
				}],
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao salvar livro',
		};
	}
}

// ============================================================================
// SAVE MUSIC
// ============================================================================

/**
 * Tool: save_music
 */
export async function save_music(
	context: ToolContext,
	params: {
		title: string;
		artist?: string;
		spotify_id?: string;
		album?: string;
		album_cover_url?: string;
		year?: number;
		duration_ms?: number;
		spotify_url?: string;
	},
): Promise<ToolOutput> {
	if (!params.title?.trim()) {
		return { success: false, error: 'Título vazio' };
	}

	try {
		if (params.spotify_id) {
			const metadata: MusicMetadata = {
				title: params.title,
				artist: params.artist ?? '',
				artists: params.artist ? [params.artist] : [],
				album: params.album ?? 'Unknown album',
				album_cover_url: params.album_cover_url,
				year: params.year,
				duration_ms: params.duration_ms ?? 0,
				genres: [],
				spotify_id: params.spotify_id,
				spotify_url: params.spotify_url ?? `https://open.spotify.com/track/${params.spotify_id}`,
			};

			const dupCheck = await itemService.checkDuplicate({
				userId: context.userId,
				type: 'music',
				title: params.title,
				externalId: params.spotify_id,
				metadata,
			});

			if (dupCheck.isDuplicate && dupCheck.existingItem) {
				return {
					success: false,
					error: 'duplicate',
					message: `⚠️ Esta música já foi salva em ${new Date(dupCheck.existingItem.createdAt).toLocaleDateString('pt-BR')}.`,
				};
			}

			const envelope = await projectionStore.writeEnvelope({
				userId: context.userId,
				sessionKey: context.conversationId,
				sourceKind: 'music',
				sourceChannel: context.provider,
				normalizedContent: params.title,
				rawArtifact: metadata,
				artifactMetadata: metadata as Record<string, unknown>,
				confidence: 1.0,
				relevanceDecay: null,
				audit: { created_via: 'chat', tool: 'save_music' },
			});

			return {
				success: true,
				data: { id: envelope?.id, title: params.title },
			};
		}

		const found = await spotifyService.searchTrack(params.title, params.artist);

		if (!found) {
			loggers.tools.warn({ title: params.title }, '⚠️ Spotify sem resultado, salvando música sem metadata');
			const fallbackMetadata = {
				title: params.title,
				artist: params.artist ?? '',
				artists: params.artist ? [params.artist] : [],
				album: 'Unknown album',
				duration_ms: 0,
				genres: [],
				spotify_id: `manual:${params.title.toLowerCase().trim().replace(/\s+/g, '-')}`,
				spotify_url: 'https://open.spotify.com',
			} as MusicMetadata;

			const envelope = await projectionStore.writeEnvelope({
				userId: context.userId,
				sessionKey: context.conversationId,
				sourceKind: 'music',
				sourceChannel: context.provider,
				normalizedContent: params.title,
				rawArtifact: fallbackMetadata,
				artifactMetadata: fallbackMetadata as Record<string, unknown>,
				confidence: 1.0,
				relevanceDecay: null,
				audit: { created_via: 'chat', tool: 'save_music' },
			});
			return {
				success: true,
				data: { id: envelope?.id, title: params.title },
			};
		}

		return {
			success: true,
			data: {
				results: [{
					type: 'music' as const,
					title: found.title,
					artist: found.artist,
					album: found.album,
					album_cover_url: found.album_cover_url,
					year: found.year,
					duration_ms: found.duration_ms,
					spotify_id: found.spotify_id,
					spotify_url: found.spotify_url,
				}],
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao salvar música',
		};
	}
}

// ============================================================================
// SAVE IMAGE
// ============================================================================

/**
 * Tool: save_image
 */
export async function save_image(
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
		const metadata = await imageMetadataService.extractMetadata(params.url);

		if (!metadata) {
			const imgMetadata = {
				url: params.url,
				description: params.description,
			} as ImageMetadata;

			const envelope = await projectionStore.writeEnvelope({
				userId: context.userId,
				sessionKey: context.conversationId,
				sourceKind: 'image',
				sourceChannel: context.provider,
				normalizedContent: params.description || params.url,
				rawArtifact: imgMetadata,
				artifactMetadata: imgMetadata as Record<string, unknown>,
				confidence: 1.0,
				relevanceDecay: null,
				audit: { created_via: 'chat', tool: 'save_image' },
			});
			return {
				success: true,
				data: { id: envelope?.id, title: params.description || params.url },
			};
		}

		return {
			success: true,
			data: {
				results: [{
					type: 'image' as const,
					url: params.url,
					description: params.description,
					format: metadata.format,
					size_bytes: metadata.size_bytes,
					source_domain: metadata.source_domain,
				}],
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao salvar imagem',
		};
	}
}

// ============================================================================
// SAVE MEMORY
// ============================================================================

/**
 * Tool: save_memory
 */
export async function save_memory(
	context: ToolContext,
	params: {
		content: string;
		semantic_type?: string;
		tags?: string[];
		source?: string;
	},
): Promise<ToolOutput> {
	if (!params.content?.trim()) {
		return { success: false, error: 'Conteúdo vazio' };
	}

	try {
		const metadata = {
			content: params.content,
			semantic_type: params.semantic_type,
			tags: params.tags,
			source: params.source,
			created_via: 'chat',
		} as MemoryMetadata;

		const dupCheck = await itemService.checkDuplicate({
			userId: context.userId,
			type: 'memory',
			title: params.content.slice(0, 100),
			metadata,
		});

		if (dupCheck.isDuplicate && dupCheck.existingItem) {
			return {
				success: false,
				error: 'duplicate',
				message: `⚠️ Esta memória já foi salva em ${new Date(dupCheck.existingItem.createdAt).toLocaleDateString('pt-BR')}.`,
			};
		}

		const envelope = await projectionStore.writeEnvelope({
			userId: context.userId,
			sessionKey: context.conversationId,
			sourceKind: 'memory',
			sourceChannel: context.provider,
			normalizedContent: params.content,
			rawArtifact: metadata,
			artifactMetadata: metadata as Record<string, unknown>,
			confidence: 1.0,
			relevanceDecay: null,
			audit: { created_via: 'chat', tool: 'save_memory' },
		});

		if (!envelope) {
			return {
				success: false,
				error: 'Erro ao criar memória no banco de dados',
			};
		}

		return {
			success: true,
			data: { id: envelope.id, title: params.content.slice(0, 100) },
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao salvar memória',
		};
	}
}

export async function search_book(
	_context: ToolContext,
	params: { title: string; author?: string },
): Promise<ToolOutput> {
	const found = await bookService.searchBook(params.title.trim(), params.author?.trim());
	if (!found) return { success: false, error: 'Nenhum livro encontrado' };
	return {
		success: true,
		data: {
			results: [{
				type: 'book' as const,
				title: found.title,
				author: found.authors?.[0],
				year: found.year,
				cover_url: found.cover_url,
				description: found.description,
				google_books_id: found.google_books_id,
				isbn: found.isbn,
				publisher: found.publisher,
				page_count: found.page_count,
				genres: found.genres,
			}],
		},
	};
}

export async function search_music(
	_context: ToolContext,
	params: { title: string; artist?: string },
): Promise<ToolOutput> {
	const found = await spotifyService.searchTrack(params.title.trim(), params.artist?.trim());
	if (!found) return { success: false, error: 'Nenhuma música encontrada' };
	return {
		success: true,
		data: {
			results: [{
				type: 'music' as const,
				title: found.title,
				artist: found.artist,
				album: found.album,
				album_cover_url: found.album_cover_url,
				year: found.year,
				duration_ms: found.duration_ms,
				spotify_id: found.spotify_id,
				spotify_url: found.spotify_url,
			}],
		},
	};
}

export const AVAILABLE_TOOLS = {
	save_note,
	save_movie,
	save_tv_show,
	save_video,
	save_link,
	search_items,
	enrich_movie,
	enrich_tv_show,
	enrich_video,
	search_book,
	search_music,
	delete_memory,
	delete_all_memories,
	get_assistant_name,
	update_user_settings,
	memory_search,
	memory_get,
	daily_log_search,
	list_calendar_events,
	create_calendar_event,
	list_todos,
	create_todo,
	schedule_reminder,
	resolve_context_reference,
	web_search,
	analyze_url,
	save_memory,
	save_book,
	save_music,
	save_image,
} as const;

export type ToolName = keyof typeof AVAILABLE_TOOLS;

/**
 * Executor genérico de tool
 */
export async function executeTool(toolName: ToolName, context: ToolContext, params: any): Promise<ToolOutput> {
	return startSpan('tool.execute', async (_span) => {
		setAttributes({
			'tool.name': toolName,
			'tool.user_id': context.userId,
			'tool.conversation_id': context.conversationId,
			'tool.params_count': Object.keys(params).length,
		});

		const tool = AVAILABLE_TOOLS[toolName];

		if (!tool) {
			setAttributes({ 'tool.status': 'not_found' });
			return {
				success: false,
				error: `Tool "${toolName}" não existe`,
			};
		}

		loggers.tools.info({ toolName }, '🔧 Executando tool');
		loggers.tools.info({ params }, '📦 Params da tool');

		try {
			const result = await startSpan(`tool.${toolName}`, async () => {
				const toolResult = await tool(context, params);
				setAttributes({
					'tool.success': toolResult.success,
					'tool.has_data': !!toolResult.data,
				});
				return toolResult;
			});
			loggers.tools.info({ toolName, success: result.success }, '✅ Tool executada');
			return result;
		} catch (error) {
			setAttributes({ 'tool.status': 'error' });
			loggers.tools.error(
				{ err: error instanceof Error ? error : new Error(String(error)), toolName },
				`❌ ToolExecutionError: falha na execução da tool '${toolName}'`,
			);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Erro desconhecido',
			};
		}
	});
}
