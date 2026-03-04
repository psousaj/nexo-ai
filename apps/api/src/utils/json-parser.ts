import { loggers } from '@/utils/logger';
import { isValidAgentDecisionV2, type AgentDecisionV2 } from '@/types/agent-decision-v2';
import { sentryMetrics } from '@/sentry';

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

	if (!isValidAgentDecisionV2Response(parsed)) {
		throw new Error('AgentDecisionV2 inválido');
	}

	return parsed;
}
