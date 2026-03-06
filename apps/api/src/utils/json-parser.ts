import { sentryMetrics } from '@/sentry';
import { type AgentDecisionV2, isValidAgentDecisionV2 } from '@/types/agent-decision-v2';
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

	// Se não começa com JSON, tenta extrair JSON embutido no texto (preamble do modelo)
	if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
		const jsonStart = cleaned.indexOf('{');
		const arrayStart = cleaned.indexOf('[');
		const start = jsonStart === -1 ? arrayStart : arrayStart === -1 ? jsonStart : Math.min(jsonStart, arrayStart);

		if (start === -1) {
			throw new Error(`Resposta não é JSON: ${cleaned.substring(0, 100)}`);
		}

		loggers.ai.warn({ preamble: cleaned.substring(0, start) }, '⚠️ LLM enviou texto antes do JSON — extraindo JSON embutido');
		cleaned = cleaned.substring(start);
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

	// Se RESPOND, precisa ter message textual
	if (obj.action === 'RESPOND' && typeof obj.message !== 'string') return false;

	return true;
}

/**
 * Aplica guardrails de normalização para resposta do agente
 */
export function normalizeAgentResponse(obj: any): void {
	if (!obj || typeof obj !== 'object') return;

	if (obj.action === 'RESPOND' && typeof obj.message === 'string' && obj.message.length > 700) {
		loggers.ai.warn({ length: obj.message.length }, 'RESPOND muito longo (máx 700 chars)');
		obj.message = `${obj.message.substring(0, 697)}...`;
	}
}

/**
 * Valida se é um AgentDecisionV2 válido
 */
export function isValidAgentDecisionV2Response(obj: unknown): obj is AgentDecisionV2 {
	const isValid = isValidAgentDecisionV2(obj);

	try {
		if (isValid) {
			sentryMetrics.increment('agent_decision_v2_parse_valid_total', 1, { action: (obj as AgentDecisionV2).action });
		} else {
			sentryMetrics.increment('agent_decision_v2_parse_invalid_total', 1, { stage: 'validation' });
		}
	} catch (error) {
		loggers.ai.debug({ err: error }, 'Falha ao enviar telemetria AgentDecisionV2');
	}

	return isValid;
}

/**
 * Normaliza desvios comuns do LLM no contrato AgentDecisionV2 antes da validação.
 * Cobre dois padrões de desvio observados:
 * 1. LLM usa o nome da tool como action (ex: "save_note") em vez de "CALL_TOOL"
 * 2. LLM usa "tool_calls" (plural) em vez de "tool_call" (singular)
 */
function normalizeAgentDecisionV2(obj: any): any {
	if (!obj || typeof obj !== 'object') return obj;

	const VALID_ACTIONS = ['CALL_TOOL', 'RESPOND', 'NOOP'];

	// Desvio 1: action é nome da tool em vez de "CALL_TOOL"
	if (typeof obj.action === 'string' && !VALID_ACTIONS.includes(obj.action)) {
		const toolName = obj.action;
		loggers.ai.warn({ originalAction: toolName }, '🔧 Normalizando action de tool-name para CALL_TOOL');
		obj.action = 'CALL_TOOL';
		if (!obj.tool_call && !obj.tool_calls) {
			obj.tool_call = { name: toolName, arguments: obj.args || obj.arguments || {} };
		}
		if (obj.response === undefined) obj.response = null;
	}

	// Desvio 2: "tool_calls" (plural) em vez de "tool_call" (singular)
	if (!obj.tool_call && obj.tool_calls) {
		loggers.ai.warn({}, '🔧 Normalizando tool_calls → tool_call');
		obj.tool_call = obj.tool_calls;
		delete obj.tool_calls;
	}

	// Garante que response seja null (nunca undefined) para CALL_TOOL
	if (obj.action === 'CALL_TOOL' && obj.response === undefined) {
		obj.response = null;
	}

	return obj;
}

/**
 * Parseia e valida resposta LLM no contrato AgentDecisionV2
 */
export function parseAgentDecisionV2FromLLM(text: string): AgentDecisionV2 {
	let parsed: unknown;
	try {
		parsed = parseJSONFromLLM(text);
	} catch (error) {
		try {
			sentryMetrics.increment('agent_decision_v2_parse_invalid_total', 1, { stage: 'json_parse' });
		} catch (metricError) {
			loggers.ai.debug({ err: metricError }, 'Falha ao enviar telemetria AgentDecisionV2');
		}

		throw error;
	}

	// Normaliza desvios comuns antes da validação estrita
	parsed = normalizeAgentDecisionV2(parsed);

	if (!isValidAgentDecisionV2Response(parsed)) {
		throw new Error('AgentDecisionV2 inválido');
	}

	return parsed;
}
