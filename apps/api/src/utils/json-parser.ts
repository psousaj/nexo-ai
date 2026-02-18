import { loggers } from '@/utils/logger';

/**
 * Utilitário para parsear JSON de respostas LLM
 * Remove markdown code blocks e limpa o JSON
 */

/**
 * Remove markdown code blocks e parseia JSON
 * Suporta formatos:
 * - ```json\n{...}\n```
 * - ```\n{...}\n```
 * - {...}
 */
export function parseJSONFromLLM(text: string): any {
	if (!text?.trim()) {
		throw new Error('Texto vazio');
	}

	// Remove markdown code blocks (```json ou ```)
	let cleaned = text.trim();

	// Detecta mensagens de erro/fallback (não são JSON)
	if (cleaned.startsWith('😅') || cleaned.startsWith('⚠️') || cleaned.startsWith('❌')) {
		throw new Error(`Resposta é mensagem de erro: ${cleaned.substring(0, 100)}`);
	}

	// Remove ```json e ``` no começo/fim
	cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

	// Remove espaços em branco extras
	cleaned = cleaned.trim();

	// Se não parece ser JSON, throw erro mais específico
	if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
		throw new Error(`Resposta não é JSON: ${cleaned.substring(0, 100)}`);
	}

	// Tenta parsear
	try {
		return JSON.parse(cleaned);
	} catch (error) {
		loggers.ai.error({ err: error, cleaned: cleaned.substring(0, 200) }, '❌ Falha ao parsear JSON');
		throw new Error(`JSON inválido: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
	}
}

/**
 * Valida se é um AgentLLMResponse válido
 */
export function isValidAgentResponse(obj: any): boolean {
	if (!obj || typeof obj !== 'object') return false;

	// Valida campos obrigatórios
	if (!obj.schema_version || !obj.action) return false;

	// Valida action
	const validActions = ['CALL_TOOL', 'RESPOND', 'NOOP'];
	if (!validActions.includes(obj.action)) return false;

	// Se CALL_TOOL, precisa ter tool
	if (obj.action === 'CALL_TOOL' && !obj.tool) return false;

	// Se RESPOND, precisa ter message
	if (obj.action === 'RESPOND' && !obj.message) return false;

	return true;
}
