// ============================================================================
// CONTEXT RESOLUTION TOOL
// ============================================================================

/**
 * Resolve uma referência contextual do usuário ("esse primeiro", "aquele filme", "era esse")
 */
export async function resolve_context_reference(
	context: ToolContext,
	params: { reference_hint: string },
): Promise<ToolOutput> {
	const { conversationId } = context;
	const { reference_hint } = params;

	const history = await conversationService.getHistory(conversationId, 6);
	const assistantMessages = history.filter((m) => m.role === 'assistant').reverse();

	if (assistantMessages.length === 0) {
		return {
			success: false,
			error: 'Nenhuma mensagem do assistente encontrada no histórico recente.',
		};
	}

	const entityPatterns = [
		/['"]([^'"]{2,60})['"]/g,
		/(?:como|seria|parece|chama(?:do)?|título|chamado)\s+['"]?([A-Z][\w\s:–-]{1,50})['"]?/gi,
		/(?:^|\n)\d+[.)\s]+([A-Z][\w\s:–-]{1,50})/gm,
	];

	interface Candidate {
		entity: string;
		type: 'movie' | 'tv_show' | 'video' | 'link' | 'note' | null;
		source: string;
	}

	const candidates: Candidate[] = [];

	for (const msg of assistantMessages) {
		for (const pattern of entityPatterns) {
			let match: RegExpExecArray | null;
			const re = new RegExp(pattern.source, pattern.flags);
			while ((match = re.exec(msg.content)) !== null) {
				const entity = match[1]?.trim();
				if (entity && entity.length >= 2) {
					candidates.push({ entity, type: null, source: msg.content.slice(0, 120) });
				}
			}
		}
		if (candidates.length > 0) break;
	}

	if (candidates.length === 0) {
		return {
			success: false,
			error: 'Não consegui identificar o item referenciado nas mensagens recentes.',
		};
	}

	const best = candidates[0];

	return {
		success: true,
		data: {
			resolved: best.entity,
			type: best.type,
			confidence: candidates.length === 1 ? 0.9 : 0.7,
			source_message: best.source,
		},
	};
}

// ============================================================================
// WEB SEARCH TOOL
// ============================================================================

/**
 * Tool: web_search
 */
export async function web_search(
	_context: ToolContext,
	params: {
		query: string;
		count?: number;
	},
): Promise<ToolOutput> {
	if (!params.query?.trim()) {
		return { success: false, error: 'Query vazia' };
	}

	try {
		const results = await braveSearchService.search(params.query, params.count ?? 5);

		if (results.length === 0) {
			return {
				success: false,
				error: 'Nenhum resultado encontrado para a busca',
			};
		}

		return {
			success: true,
			data: {
				type: 'web_search' as const,
				query: params.query,
				results,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao buscar na web',
		};
	}
}

// ============================================================================
// ANALYZE URL TOOL
// ============================================================================

export type UrlContentType = 'movie' | 'tv_show' | 'music' | 'video' | 'book' | 'image' | 'link';
export type TypeCategory = 'enrichable' | 'text';

interface UrlAnalysisResult {
	detected_type: UrlContentType;
	type_category: TypeCategory;
	title?: string;
	metadata?: Record<string, unknown>;
}

const TYPE_CATEGORY: Record<UrlContentType, TypeCategory> = {
	movie: 'enrichable',
	tv_show: 'enrichable',
	music: 'enrichable',
	video: 'enrichable',
	book: 'enrichable',
	image: 'text',
	link: 'text',
};

function detectTypeFromUrl(urlStr: string): UrlContentType | null {
	try {
		const url = new URL(urlStr);
		const hostname = url.hostname.replace(/^www\./, '');
		const pathname = url.pathname;

		if (/\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/i.test(urlStr)) return 'image';
		if (/^(i\.)?imgur\.com/.test(hostname)) return 'image';
		if (hostname === 'unsplash.com' && pathname.startsWith('/photos/')) return 'image';
		if (hostname === 'pexels.com' && pathname.startsWith('/photo/')) return 'image';
		if (hostname === 'flickr.com' && pathname.startsWith('/photos/')) return 'image';
		if (hostname === 'pinterest.com' && pathname.startsWith('/pin/')) return 'image';

		if (hostname === 'youtube.com' && (pathname.startsWith('/watch') || pathname.startsWith('/shorts/'))) return 'video';
		if (hostname === 'youtu.be') return 'video';
		if (hostname === 'vimeo.com') return 'video';
		if (hostname === 'dailymotion.com' && pathname.startsWith('/video/')) return 'video';
		if (hostname === 'twitch.tv' && pathname.includes('/videos/')) return 'video';
		if (hostname === 'kick.com' && pathname.includes('/video/')) return 'video';
		if (hostname === 'tiktok.com' && pathname.includes('/video/')) return 'video';
		if (hostname === 'instagram.com' && (pathname.startsWith('/reel/') || pathname.startsWith('/p/'))) return 'video';

		if (hostname === 'open.spotify.com' && /\/(track|album|artist|playlist)\//.test(pathname)) return 'music';
		if (hostname === 'music.apple.com') return 'music';
		if (hostname === 'music.youtube.com') return 'music';
		if (hostname === 'soundcloud.com') return 'music';
		if (hostname === 'deezer.com' && /\/(track|album|artist)\//.test(pathname)) return 'music';
		if (hostname === 'tidal.com' && /\/(track|album|artist)\//.test(pathname)) return 'music';
		if (hostname === 'genius.com' && pathname.endsWith('-lyrics')) return 'music';
		if (hostname === 'letras.mus.br') return 'music';

		if (hostname === 'goodreads.com' && pathname.startsWith('/book/')) return 'book';
		if ((hostname === 'amazon.com.br' || hostname === 'amazon.com') && pathname.startsWith('/dp/')) return 'book';
		if (hostname === 'books.google.com' || (hostname === 'google.com' && pathname.startsWith('/books/'))) return 'book';
		if (hostname === 'skoob.com.br' && pathname.startsWith('/livro/')) return 'book';
		if (hostname === 'audible.com' && pathname.startsWith('/pd/')) return 'book';

		if (hostname === 'themoviedb.org' && pathname.startsWith('/tv/')) return 'tv_show';
		if (hostname === 'thetvdb.com' && pathname.startsWith('/series/')) return 'tv_show';
		if (hostname === 'tv.apple.com' && pathname.startsWith('/show/')) return 'tv_show';
		if (hostname === 'netflix.com' && pathname.startsWith('/title/')) return 'tv_show';
		if (hostname === 'hbomax.com' && pathname.startsWith('/series/')) return 'tv_show';
		if (hostname === 'disneyplus.com' && pathname.startsWith('/series/')) return 'tv_show';
		if (hostname === 'globoplay.globo.com' && pathname.includes('/t/')) return 'tv_show';

		if (hostname === 'imdb.com' && pathname.startsWith('/title/')) return 'movie';
		if (hostname === 'themoviedb.org' && pathname.startsWith('/movie/')) return 'movie';
		if (hostname === 'letterboxd.com' && pathname.startsWith('/film/')) return 'movie';
		if (hostname === 'rottentomatoes.com' && pathname.startsWith('/m/')) return 'movie';
		if (hostname === 'metacritic.com' && pathname.startsWith('/movie/')) return 'movie';
		if (hostname === 'adorocinema.com' && pathname.startsWith('/filmes/')) return 'movie';
		if (hostname === 'tv.apple.com' && pathname.startsWith('/movie/')) return 'movie';

		return null;
	} catch {
		return null;
	}
}

/**
 * Tool: analyze_url
 */
export async function analyze_url(
	_context: ToolContext,
	params: {
		url: string;
	},
): Promise<ToolOutput> {
	if (!params.url?.trim()) {
		return { success: false, error: 'URL vazia' };
	}

	try {
		const detectedByPattern = detectTypeFromUrl(params.url);
		const ogMetadata = await openGraphService.fetchMetadata(params.url);

		const detected_type: UrlContentType = detectedByPattern ?? 'link';
		const type_category: TypeCategory = TYPE_CATEGORY[detected_type];

		const result: UrlAnalysisResult = {
			detected_type,
			type_category,
			title: ogMetadata.og_title,
			metadata: {
				url: params.url,
				og_title: ogMetadata.og_title,
				og_description: ogMetadata.og_description,
				og_image: ogMetadata.og_image,
				domain: ogMetadata.domain,
			},
		};

		return {
			success: true,
			data: result,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Erro ao analisar URL',
		};
	}
}
