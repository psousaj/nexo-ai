/**
 * Tool Service
 * 
 * Gerencia tools globalmente habilitadas/desabilitadas.
 * Feature flags: Admin pode ligar/desligar funcionalidades para TODOS os usuários.
 * 
 * ADR-019: Pluggable Tools System with CASL Protection
 */

import { db } from '@/db';
import { globalTools } from '@/db/schema';
import type { ToolName } from '@/types';
import { loggers } from '@/utils/logger';
import { eq } from 'drizzle-orm';
import {
	getSystemTools,
	getToolDefinition,
	getUserTools,
	isSystemTool,
	type ToolDefinition,
} from './registry';

class ToolService {
	/**
	 * Retorna tools globalmente habilitadas (system + user habilitadas)
	 */
	async getEnabledTools(): Promise<ToolDefinition[]> {
		try {
			// 1. System tools sempre disponíveis
			const systemTools = getSystemTools();

			// 2. Buscar user tools no banco
			const globalToolsDb = await db.select().from(globalTools);

			// 3. Se não tem no banco, inicializar com defaults
			if (globalToolsDb.length === 0) {
				await this.initializeTools();
				return this.getEnabledTools(); // Recursivo
			}

			// 4. Filtrar user tools habilitadas
			const enabledUserTools = globalToolsDb
				.filter((t) => t.enabled && t.category === 'user')
				.map((t) => getToolDefinition(t.toolName as ToolName))
				.filter((t): t is ToolDefinition => t !== undefined);

			return [...systemTools, ...enabledUserTools];
		} catch (error) {
			loggers.ai.error({ err: error }, '❌ Erro ao buscar tools globais');
			// Fallback: retornar apenas system tools
			return getSystemTools();
		}
	}

	/**
	 * Retorna apenas save tools habilitadas globalmente
	 */
	async getSaveTools(): Promise<ToolDefinition[]> {
		const allTools = await this.getEnabledTools();
		return allTools.filter((t) => t.category === 'user' && t.name.startsWith('save_'));
	}

	/**
	 * Verifica se tool está globalmente habilitada
	 */
	async canUseTool(toolName: ToolName): Promise<boolean> {
		// System tools sempre disponíveis
		if (isSystemTool(toolName)) {
			return true;
		}

		// User tools: verificar se está habilitada globalmente
		const enabledTools = await this.getEnabledTools();
		return enabledTools.some((t) => t.name === toolName);
	}

	/**
	 * Inicializa tools pela primeira vez (todas habilitadas por padrão)
	 */
	async initializeTools(): Promise<void> {
		loggers.ai.info('🔧 Inicializando tools globais');

		const allUserTools = getUserTools();

		const toolsToInsert = allUserTools.map((tool) => ({
			toolName: tool.name,
			enabled: true, // Todas habilitadas por padrão
			category: tool.category,
		}));

		await db.insert(globalTools).values(toolsToInsert).onConflictDoNothing();

		loggers.ai.info({ count: toolsToInsert.length }, '✅ Tools globais inicializadas');
	}

	/**
	 * Atualiza tool global (admin only)
	 */
	async updateTool(toolName: ToolName, enabled: boolean): Promise<void> {
		// Não permitir alterar system tools
		if (isSystemTool(toolName)) {
			throw new Error('System tools não podem ser desabilitadas');
		}

		await db
			.update(globalTools)
			.set({ enabled, updatedAt: new Date() })
			.where(eq(globalTools.toolName, toolName));

		loggers.ai.info({ toolName, enabled }, '🔧 Tool global atualizada');
	}

	/**
	 * Lista todas as tools (enabled + disabled)
	 */
	async getAllTools(): Promise<Array<ToolDefinition & { enabled: boolean }>> {
		const globalToolsDb = await db.select().from(globalTools);

		// Se vazio, inicializar
		if (globalToolsDb.length === 0) {
			await this.initializeTools();
			return this.getAllTools();
		}

		return globalToolsDb
			.map((t) => {
				const def = getToolDefinition(t.toolName as ToolName);
				if (!def) return null;
				return { ...def, enabled: t.enabled };
			})
			.filter((t): t is ToolDefinition & { enabled: boolean } => t !== null);
	}

	/**
	 * Habilita todas as tools
	 */
	async enableAllTools(): Promise<void> {
		const allUserTools = getUserTools();

		for (const tool of allUserTools) {
			await this.updateTool(tool.name, true);
		}

		loggers.ai.info('✅ Todas as tools habilitadas');
	}

	/**
	 * Desabilita todas as tools
	 */
	async disableAllTools(): Promise<void> {
		const allUserTools = getUserTools();

		for (const tool of allUserTools) {
			await this.updateTool(tool.name, false);
		}

		loggers.ai.info('❌ Todas as tools desabilitadas');
	}
}

// Export singleton
export const toolService = new ToolService();
