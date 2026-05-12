import { db } from '@/db';
import { userChannels } from '@/db/schema/user-channels';
import { PostgresMemoryRegistry } from '@/core/registries/memory-registry';
import type { HermesToolDescriptor } from '../policies/policy-types';
import { eq, and } from 'drizzle-orm';

export interface HermesToolRegistry {
	listEnabled(): Promise<HermesToolDescriptor[]>;
	execute(name: string, input: unknown): Promise<unknown>;
	buildHermesToolCatalog(): Promise<HermesToolDescriptor[]>;
}

export interface ToolRegistryDeps {
	tmdbService?: {
		searchMovies(query: string, year?: number): Promise<unknown[]>;
		getStreamingProviders(tmdbId: number, type?: 'movie' | 'tv'): Promise<unknown>;
	};
	youtubeService?: { enrichYouTubeVideo(url: string): Promise<unknown> };
	spotifyService?: { searchTrack(title: string, artist?: string): Promise<unknown> };
	bookService?: { searchBook(title: string, author?: string): Promise<unknown> };
	braveSearchService?: { search(query: string, count?: number): Promise<unknown[]> };
	openGraphService?: { fetchMetadata(url: string): Promise<unknown> };
	memoryRegistry?: PostgresMemoryRegistry;
}

export class PostgresToolRegistry implements HermesToolRegistry {
	constructor(private deps: ToolRegistryDeps = {}) {}

	async buildHermesToolCatalog(): Promise<HermesToolDescriptor[]> {
		const catalog = new Map<string, HermesToolDescriptor>();

		// Enrichment tools
		for (const tool of this.getEnrichmentTools()) {
			catalog.set(tool.name, tool);
		}

		// Built-in tools (highest priority)
		for (const tool of this.getBuiltInTools()) {
			catalog.set(tool.name, tool);
		}

		return Array.from(catalog.values());
	}

	async listEnabled(): Promise<HermesToolDescriptor[]> {
		return this.buildHermesToolCatalog();
	}

	async execute(name: string, input: unknown): Promise<unknown> {
		const catalog = await this.buildHermesToolCatalog();
		const tool = catalog.find((t) => t.name === name);
		if (!tool) throw new Error(`Tool ${name} not found`);
		return tool.execute(null, input as Record<string, unknown>);
	}

	private getBuiltInTools(): HermesToolDescriptor[] {
		const memoryRegistry = this.deps.memoryRegistry ?? new PostgresMemoryRegistry();

		async function extractUserId(ctx: unknown): Promise<string> {
			const input = ctx as Record<string, unknown> | undefined;
			const sessionKey = (input?.sessionKey as string) ?? '';
			const parts = sessionKey.split(':');
			const peerId = parts[4];
			if (!peerId) return 'unknown';
			const channel = parts[2] ?? 'unknown';
			try {
				const [link] = await db
					.select({ userId: userChannels.userId })
					.from(userChannels)
					.where(and(eq(userChannels.channel, channel as any), eq(userChannels.channelUserId, peerId)))
					.limit(1);
				if (link) return link.userId;
			} catch {
				// fallback to peerId
			}
			return peerId;
		}

		return [
			{
				name: 'save_memory',
				description:
					'Salva uma memória permanente sobre o usuário. Use quando o usuário pedir explicitamente ou quando você identificar informação relevante que mereça ser lembrada.',
				jsonSchema: {
					type: 'object',
					properties: {
						content: { type: 'string', description: 'Conteúdo da memória' },
						category: {
							type: 'string',
							enum: ['work', 'personal', 'tech', 'general'],
							description: 'Categoria da memória',
						},
					},
					required: ['content'],
				},
				policy: 'auto',
				execute: async (ctx: unknown, input: Record<string, unknown>) => {
					const userId = await extractUserId(ctx);
					const sessionKey = ((ctx as Record<string, unknown>)?.sessionKey as string) ?? 'built-in';
					const result = await memoryRegistry.store({
						userId,
						sessionKey,
						sourceKind: 'intake',
						content: input.content as string,
						confidence: 1,
					});
					if (!result) {
						return { status: 'save_failed', error: 'Erro interno ao salvar memória' };
					}
					// Propagate structured errors (e.g., user not found) back to LLM
					if (result && typeof result === 'object' && 'status' in result && result.status === 'error') {
						return result;
					}
					return { status: 'saved', content: input.content };
				},
			},
			{
				name: 'search_memories',
				description:
					'Busca nas memórias salvas do usuário. Use quando o usuario pedir "minhas coisas salvas", "o que eu salvei", "memorias", etc. Retorna titulo, data em que foi salvo e confianca. Ao responder, liste cada memoria com emoji tematico e mencione QUANDO foi salva (ex: "salvo em 12/05").',
				jsonSchema: {
					type: 'object',
					properties: {
						query: { type: 'string', description: 'Termo de busca (ou vazio para listar todas)' },
					},
				},
				policy: 'auto',
				execute: async (ctx: unknown, _input: Record<string, unknown>) => {
					const userId = await extractUserId(ctx);
					const results = await memoryRegistry.loadRelevant({
						userId,
						limit: 10,
					});
					return { results };
				},
			},
			{
				name: 'clarify',
				description:
					'Pergunta ao usuário com botões de opção para desambiguar ou confirmar. Use choices para listar opções. Ex: clarify("É esse?", ["Sim", "Não"])',
				jsonSchema: {
					type: 'object',
					properties: {
						question: { type: 'string', description: 'Pergunta clara para o usuário' },
						choices: {
							type: 'array',
							items: { type: 'string' },
							maxItems: 4,
							description: 'OPÇÕES para o usuário escolher (max 4). Ex: ["Título (ano)", "Título 2 (ano)"]',
						},
					},
					required: ['question', 'choices'],
				},
				policy: 'auto',
				execute: async (_ctx: unknown, input: Record<string, unknown>) => {
					return {
						_requiresInput: true,
						status: 'asked',
						note: 'Pergunta enviada ao usuário. A próxima mensagem do usuário será a resposta.',
					};
				},
			},
			{
				name: 'send_confirm',
				description:
					'Mostra imagem (poster/capa/foto) com botoes Sim/Nao para confirmar. Use para filmes, musicas, livros e qualquer conteudo que precise de confirmacao do usuario. O usuario clica Sim ou Nao. Inclua o maximo de detalhes possiveis na descricao.',
				jsonSchema: {
					type: 'object',
					properties: {
						imageUrl: { type: 'string', description: 'URL do poster ou capa' },
						title: { type: 'string', description: 'Titulo principal' },
						description: { type: 'string', description: 'Sinopse, resumo ou descricao do conteudo' },
						year: { type: 'string', description: 'Ano de lancamento' },
						artist: { type: 'string', description: 'Artista ou banda (para musicas)' },
						album: { type: 'string', description: 'Album (para musicas)' },
						director: { type: 'string', description: 'Diretor (para filmes)' },
						genres: { type: 'string', description: 'Generos separados por virgula' },
					},
					required: ['imageUrl', 'title'],
				},
				policy: 'auto',
				execute: async (_ctx: unknown, _input: Record<string, unknown>) => {
					return { _requiresInput: true, type: 'confirm', status: 'awaiting' };
				},
			},
			{
				name: 'text_to_speech',
				description:
					'Transforma texto em áudio (voz). Use quando o usuário pedir para falar algo ou quando estiver em modo voz.',
				jsonSchema: {
					type: 'object',
					properties: {
						text: { type: 'string', description: 'Texto para converter em fala' },
					},
					required: ['text'],
				},
				policy: 'auto',
				execute: async (_ctx: unknown, input: Record<string, unknown>) => {
					return { type: 'tts', text: input.text, status: 'synthesized' };
				},
			},
		];
	}

	private getEnrichmentTools(): HermesToolDescriptor[] {
		const tools: HermesToolDescriptor[] = [];
		const deps = this.deps;

		if (deps.tmdbService) {
			tools.push({
				name: 'search_movie',
				description:
					'Busca filmes e séries no TMDB. Retorna título, ano, gêneros, diretor, sinopse. Use quando o usuário mencionar um filme ou série.',
				jsonSchema: {
					type: 'object',
					properties: {
						query: { type: 'string', description: 'Título do filme/série' },
						year: { type: 'number', description: 'Ano opcional para filtrar' },
					},
					required: ['query'],
				},
				policy: 'auto',
				execute: async (_ctx: unknown, input: Record<string, unknown>) => {
					return deps.tmdbService!.searchMovies(input.query as string, input.year as number | undefined);
				},
			});
			tools.push({
				name: 'search_watch_providers',
				description:
					'Busca onde assistir um filme ou série nos streamings (Netflix, Prime, etc). Use quando o usuário perguntar "onde assistir" ou "tem em qual streaming". Retorna disponibilidade no Brasil.',
				jsonSchema: {
					type: 'object',
					properties: {
						tmdbId: { type: 'number', description: 'ID do filme/série no TMDB' },
						type: { type: 'string', enum: ['movie', 'tv'], description: 'tipo: movie ou tv' },
					},
					required: ['tmdbId'],
				},
				policy: 'auto',
				execute: async (_ctx: unknown, input: Record<string, unknown>) => {
					return deps.tmdbService!.getStreamingProviders(
						input.tmdbId as number,
						(input.type as 'movie' | 'tv') ?? 'movie',
					);
				},
			});
		}

		if (deps.youtubeService) {
			tools.push({
				name: 'search_youtube',
				description: 'Busca informações de um vídeo do YouTube a partir da URL.',
				jsonSchema: {
					type: 'object',
					properties: {
						url: { type: 'string', description: 'URL do vídeo do YouTube' },
					},
					required: ['url'],
				},
				policy: 'auto',
				execute: async (_ctx: unknown, input: Record<string, unknown>) => {
					return deps.youtubeService!.enrichYouTubeVideo(input.url as string);
				},
			});
		}

		if (deps.spotifyService) {
			tools.push({
				name: 'search_music',
				description: 'Busca música no Spotify pelo título e artista.',
				jsonSchema: {
					type: 'object',
					properties: {
						title: { type: 'string', description: 'Título da música' },
						artist: { type: 'string', description: 'Artista (opcional)' },
					},
					required: ['title'],
				},
				policy: 'auto',
				execute: async (_ctx: unknown, input: Record<string, unknown>) => {
					return deps.spotifyService!.searchTrack(input.title as string, input.artist as string | undefined);
				},
			});
		}

		if (deps.bookService) {
			tools.push({
				name: 'search_book',
				description: 'Busca livro no Google Books pelo título.',
				jsonSchema: {
					type: 'object',
					properties: {
						title: { type: 'string', description: 'Título do livro' },
						author: { type: 'string', description: 'Autor (opcional)' },
					},
					required: ['title'],
				},
				policy: 'auto',
				execute: async (_ctx: unknown, input: Record<string, unknown>) => {
					return deps.bookService!.searchBook(input.title as string, input.author as string | undefined);
				},
			});
		}

		if (deps.braveSearchService) {
			tools.push({
				name: 'search_web',
				description: 'Busca informações atualizadas na web. Use para notícias, preços, fatos recentes.',
				jsonSchema: {
					type: 'object',
					properties: {
						query: { type: 'string', description: 'Termo de busca' },
					},
					required: ['query'],
				},
				policy: 'auto',
				execute: async (_ctx: unknown, input: Record<string, unknown>) => {
					return deps.braveSearchService!.search(input.query as string);
				},
			});
		}

		if (deps.openGraphService) {
			tools.push({
				name: 'get_link_preview',
				description: 'Obtém preview de um link (título, descrição, imagem).',
				jsonSchema: {
					type: 'object',
					properties: {
						url: { type: 'string', description: 'URL do link' },
					},
					required: ['url'],
				},
				policy: 'auto',
				execute: async (_ctx: unknown, input: Record<string, unknown>) => {
					return deps.openGraphService!.fetchMetadata(input.url as string);
				},
			});
		}

		return tools;
	}
}
