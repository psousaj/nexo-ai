import { PostgresProjectionStore } from '@/core/memory/projection-store';
import { PostgresMemoryRegistry } from '@/core/registries/memory-registry';
import { db } from '@/db';
import { agentSkills } from '@/db/schema/agent-skills';
import { globalTools } from '@/db/schema/global-tools';
import type { HermesToolDescriptor } from '../policies/policy-types';

export interface HermesToolRegistry {
	listEnabled(): Promise<HermesToolDescriptor[]>;
	execute(name: string, input: unknown): Promise<unknown>;
	buildHermesToolCatalog(): Promise<HermesToolDescriptor[]>;
}

export interface ToolRegistryDeps {
	tmdbService?: { searchMovies(query: string, year?: number): Promise<unknown[]> };
	youtubeService?: { enrichYouTubeVideo(url: string): Promise<unknown> };
	spotifyService?: { searchTrack(title: string, artist?: string): Promise<unknown> };
	bookService?: { searchBook(title: string, author?: string): Promise<unknown> };
	braveSearchService?: { search(query: string, count?: number): Promise<unknown[]> };
	openGraphService?: { fetchMetadata(url: string): Promise<unknown> };
	projectionStore?: PostgresProjectionStore;
	memoryRegistry?: PostgresMemoryRegistry;
}

export class PostgresToolRegistry implements HermesToolRegistry {
	constructor(private deps: ToolRegistryDeps = {}) {}

	async buildHermesToolCatalog(): Promise<HermesToolDescriptor[]> {
		const dbTools = await db.select().from(globalTools);
		const skills = await db.select().from(agentSkills);

		const catalog: HermesToolDescriptor[] = [
			...dbTools.map((t) => ({
				name: t.toolName,
				description: '',
				jsonSchema: {} as Record<string, unknown>,
				policy: 'auto' as const,
				execute: async () => ({ tool: t.toolName, status: 'executed', note: 'configure via tool implementations' }),
			})),
			...skills.map((s) => ({
				name: s.name,
				description: s.description ?? '',
				jsonSchema: { type: 'object', properties: {} } as Record<string, unknown>,
				policy: 'auto' as const,
				execute: async () => ({ skill: s.name, status: 'executed' }),
			})),
			...this.getBuiltInTools(),
			...this.getEnrichmentTools(),
		];

		return catalog;
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
		const projectionStore = this.deps.projectionStore ?? new PostgresProjectionStore();

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
				execute: async (_ctx: unknown, input: Record<string, unknown>) => {
					await projectionStore.store({
						userId: 'default',
						sessionKey: 'built-in',
						sourceKind: 'intake',
						content: input.content as string,
						confidence: 1,
					});
					return { status: 'saved', content: input.content };
				},
			},
			{
				name: 'search_memories',
				description:
					'Busca nas memórias salvas do usuário. Use para lembrar informações que o usuário já salvou antes.',
				jsonSchema: {
					type: 'object',
					properties: {
						query: { type: 'string', description: 'Termo de busca' },
					},
					required: ['query'],
				},
				policy: 'auto',
				execute: async (_ctx: unknown, _input: Record<string, unknown>) => {
					const results = await memoryRegistry.loadRelevant({
						userId: 'default',
						limit: 10,
					});
					return { results };
				},
			},
		];
	}

	private getEnrichmentTools(): HermesToolDescriptor[] {
		const tools: HermesToolDescriptor[] = [];
		const deps = this.deps;

		if (deps.tmdbService) {
			tools.push({
				name: 'search_movie_tmdb',
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
