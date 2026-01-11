import { itemService } from '@/services/item-service';
import { enrichmentService } from '@/services/enrichment';
import type { ItemType } from '@/types';

/**
 * Representa uma chamada de tool pelo LLM
 */
export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, any>;
}

/**
 * Resultado da execução de uma tool
 */
export interface ToolResult {
	tool_call_id: string;
	output: string;
	success: boolean;
}

/**
 * Contexto necessário para executar tools
 */
export interface ToolExecutionContext {
	userId: string;
	externalId: string;
	conversationId: string;
}

/**
 * Executor de tools - processa tool calls do LLM
 */
export class ToolExecutor {
	constructor(private context: ToolExecutionContext) {}

	/**
	 * Executa uma lista de tool calls
	 */
	async executeCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
		const results: ToolResult[] = [];

		for (const call of toolCalls) {
			try {
				console.log(`🔧 Executando tool: ${call.name}`);
				console.log(`📋 Args:`, JSON.stringify(call.arguments));

				const output = await this.executeOne(call);

				results.push({
					tool_call_id: call.id,
					output: JSON.stringify(output),
					success: true,
				});

				console.log(`✅ Tool ${call.name} executada com sucesso`);
			} catch (error) {
				console.error(`❌ Erro ao executar tool ${call.name}:`, error);

				results.push({
					tool_call_id: call.id,
					output: JSON.stringify({
						error: error instanceof Error ? error.message : 'Erro desconhecido',
					}),
					success: false,
				});
			}
		}

		return results;
	}

	/**
	 * Executa uma tool específica
	 */
	private async executeOne(call: ToolCall): Promise<any> {
		switch (call.name) {
			case 'save_item':
				return await this.saveItemTool(call.arguments as any);

			case 'search_items':
				return await this.searchItemsTool(call.arguments as any);

			case 'enrich_metadata':
				return await this.enrichMetadataTool(call.arguments as any);

			case 'apply_user_timeout':
				return await this.applyTimeoutTool(call.arguments as any);

			case 'get_streaming_providers':
				return await this.getStreamingProvidersTool(call.arguments as any);

			default:
				throw new Error(`Tool desconhecida: ${call.name}`);
		}
	}

	/**
	 * Tool: save_item
	 */
	private async saveItemTool(args: { type: ItemType; title: string; metadata?: any }) {
		const item = await itemService.createItem({
			userId: this.context.userId,
			type: args.type,
			title: args.title,
			metadata: args.metadata,
		});

		return {
			success: true,
			item_id: item.item.id,
			message: `${args.type} "${args.title}" salvo com sucesso!`,
		};
	}

	/**
	 * Tool: search_items
	 */
	private async searchItemsTool(args: { query?: string; type?: ItemType | 'all'; limit?: number }) {
		const items = await itemService.getUserItems(
			this.context.userId,
			args.query,
			args.type === 'all' ? undefined : args.type,
			args.limit || 10
		);

		return {
			success: true,
			count: items.length,
			items: items.map((item) => ({
				id: item.id,
				type: item.type,
				title: item.title,
				created_at: item.createdAt,
			})),
		};
	}

	/**
	 * Tool: enrich_metadata
	 */
	private async enrichMetadataTool(args: { type: 'movie' | 'tv_show' | 'video'; query: string }) {
		if (args.type === 'movie') {
			const results = await enrichmentService.searchMovies(args.query);

			if (results.length === 0) {
				return {
					success: false,
					message: `Nenhum filme encontrado para "${args.query}"`,
				};
			}

			return {
				success: true,
				results: results.slice(0, 5).map((movie) => ({
					id: movie.id,
					title: movie.title,
					year: movie.release_date?.split('-')[0],
				})),
			};
		} else if (args.type === 'tv_show') {
			const results = await enrichmentService.searchTVShows(args.query);

			if (results.length === 0) {
				return {
					success: false,
					message: `Nenhuma série encontrada para "${args.query}"`,
				};
			}

			return {
				success: true,
				results: results.slice(0, 5).map((show) => ({
					id: show.id,
					name: show.name,
					year: show.first_air_date?.split('-')[0],
				})),
			};
		} else if (args.type === 'video') {
			const metadata = await enrichmentService.enrich('video', {
				url: args.query,
			});

			return {
				success: true,
				metadata,
			};
		}

		throw new Error(`Tipo não suportado: ${args.type}`);
	}

	/**
	 * Tool: apply_user_timeout
	 */
	private async applyTimeoutTool(args: { reason: string }) {
		const TIMEOUT_DURATION = 5 * 60 * 1000; // 5 minutos
		const timeoutUntil = Date.now() + TIMEOUT_DURATION;

		// Importa dinamicamente para evitar circular dependency
		const { userTimeouts } = await import('@/routes/webhook');

		userTimeouts.set(this.context.externalId, timeoutUntil);

		console.warn(`⏱️ Timeout aplicado: ${this.context.externalId} - Motivo: ${args.reason}`);

		return {
			success: true,
			timeout_until: new Date(timeoutUntil).toISOString(),
			reason: args.reason,
			message: 'Timeout de 5 minutos aplicado. O usuário não poderá enviar mensagens até lá.',
		};
	}

	/**
	 * Tool: get_streaming_providers
	 */
	private async getStreamingProvidersTool(args: { tmdbId: number }) {
		const providers = await enrichmentService.getStreamingProviders(args.tmdbId);

		if (!providers || providers.length === 0) {
			return {
				success: true,
				available_on_streaming: false,
				needs_download: true,
				message: 'Este filme não está disponível em nenhum serviço de streaming. Será necessário baixar via torrent/Radarr.',
				providers: [],
			};
		}

		return {
			success: true,
			available_on_streaming: true,
			needs_download: false,
			providers: providers.map((p) => ({
				name: p.provider_name,
				type: p.type, // "flatrate", "rent", "buy"
				logo: p.logo_path,
			})),
			message: `Disponível em: ${providers.map((p) => p.provider_name).join(', ')}`,
		};
	}
}

/**
 * Instância singleton removida - usar new ToolExecutor(context) diretamente
 */
