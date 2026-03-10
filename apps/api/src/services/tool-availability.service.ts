/**
 * ToolAvailabilityService
 *
 * Fonte de verdade global sobre quais tools estão disponíveis.
 * Cache Redis TTL 1h com chave global (sem filtro por usuário — sem flags per-user ainda).
 * Invalidado manualmente ao toggle de tool no admin.
 *
 * ADR-019: Pluggable Tools System
 */

import { cacheDelete, cacheGet, cacheSet } from '@/config/redis';
import { instrumentService } from '@/services/service-instrumentation';
import { toolService } from '@/services/tools/tool.service';
import { loggers } from '@/utils/logger';

const CACHE_KEY = 'tool_availability:global';
const CACHE_TTL = 3600; // 1 hora

export interface ToolAvailabilityResult {
	/** Nomes das tools habilitadas globalmente (strings do DB). */
	tools: string[];
}

class ToolAvailabilityService {
	/**
	 * Retorna lista de ToolName globalmente habilitadas.
	 * Tenta Redis primeiro; se miss, consulta DB e armazena no cache.
	 */
	async getAvailableTools(): Promise<ToolAvailabilityResult> {
		try {
			const cached = await cacheGet<ToolAvailabilityResult>(CACHE_KEY);
			if (cached) {
				loggers.ai.debug('⚡ tool_availability cache hit');
				return cached;
			}
		} catch {
			// Redis indisponível — não bloquear
		}

		const enabledTools = await toolService.getEnabledTools();
		const result: ToolAvailabilityResult = {
			tools: enabledTools.map((t) => t.name),
		};

		try {
			await cacheSet(CACHE_KEY, result, CACHE_TTL);
		} catch {
			// Redis indisponível — continuar sem cache
		}

		return result;
	}

	/**
	 * Invalida o cache global de tools.
	 * Deve ser chamado sempre que uma tool for habilitada/desabilitada no admin.
	 */
	async invalidateCache(): Promise<void> {
		try {
			await cacheDelete(CACHE_KEY);
			loggers.ai.info('🗑️ tool_availability cache invalidado');
		} catch {
			// ignorar falha de cache
		}
	}
}

export const toolAvailabilityService = instrumentService('tool-availability', new ToolAvailabilityService());
