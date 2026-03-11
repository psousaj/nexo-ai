import { sentryMetrics } from '@/sentry';
import {
	type AgentDecisionV2,
	AgentDecisionCategorySchema,
	AgentDecisionTriggerSchema,
	AgentDecisionV2Schema,
} from '@/types/agent-decision-v2';
import { loggers } from '@/utils/logger';
import { z } from 'zod';

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

		loggers.ai.warn(
			{ preamble: cleaned.substring(0, start) },
			'⚠️ LLM enviou texto antes do JSON — extraindo JSON embutido',
		);
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
 * Valida se é um AgentDecisionV2 válido (usa schema estrito como source of truth).
 */
export function isValidAgentDecisionV2Response(obj: unknown): obj is AgentDecisionV2 {
	const result = AgentDecisionV2Schema.safeParse(obj);

	try {
		if (result.success) {
			sentryMetrics.increment('agent_decision_v2_parse_valid_total', 1, { action: result.data.action });
		} else {
			sentryMetrics.increment('agent_decision_v2_parse_invalid_total', 1, { stage: 'validation' });
		}
	} catch (error) {
		loggers.ai.debug({ err: error }, 'Falha ao enviar telemetria AgentDecisionV2');
	}

	return result.success;
}

/**
 * Schema leniente para parsing de saídas LLM.
 * Normaliza desvios comuns via .catch() (fallbacks declarativos) e .transform() (mutações estruturais).
 * Após normalização, o resultado é validado pelo schema estrito AgentDecisionV2Schema.
 */
const reasoningIntentFallback = {
	category: 'conversation' as const,
	confidence: 0.5,
	trigger: 'natural_language' as const,
};

const LenientAgentDecisionV2Schema = z
	.object({
		// Aceita qualquer string (inclusive ausente); o schema estrito rejeita valores != '2.0'
		schema_version: z.string().default('2.0'),
		action: z.string().min(1),
		reasoning_intent: z
			.object({
				category: AgentDecisionCategorySchema.catch('conversation'),
				confidence: z.coerce.number().transform((v) => Math.min(1, Math.max(0, v))).catch(0.5),
				trigger: AgentDecisionTriggerSchema.catch('natural_language'),
			})
			.catch(reasoningIntentFallback),
		response: z
			.object({ text: z.string().min(1), tone_profile: z.string().min(1) })
			.nullish()
			.transform((v) => v ?? null),
		tool_call: z
			.object({
				name: z.string().min(1),
				arguments: z.record(z.unknown()),
				idempotency_key: z.string().optional(),
			})
			.nullish()
			.transform((v) => v ?? null),
		tool_calls: z.unknown().optional(),
		guardrails: z.object({ requires_confirmation: z.boolean(), deterministic_path: z.boolean() }).optional(),
		args: z.record(z.unknown()).optional(),
		arguments: z.record(z.unknown()).optional(),
	})
	.transform((obj) => {
		const VALID_ACTIONS = ['CALL_TOOL', 'RESPOND', 'NOOP'];
		let { action } = obj;
		let { tool_call, response } = obj;

		// Desvio 1: action é nome da tool em vez de "CALL_TOOL"
		if (!VALID_ACTIONS.includes(action)) {
			loggers.ai.warn({ originalAction: action }, '🔧 Normalizando action de tool-name para CALL_TOOL');
			tool_call ??= (obj.tool_calls as typeof tool_call) ?? {
				name: action,
				arguments: (obj.args ?? obj.arguments ?? {}) as Record<string, unknown>,
			};
			action = 'CALL_TOOL';
			response = null;
		}

		// Desvio 2: tool_calls (plural) → tool_call
		if (!tool_call && obj.tool_calls) {
			loggers.ai.warn({}, '🔧 Normalizando tool_calls → tool_call');
			tool_call = obj.tool_calls as unknown as typeof tool_call;
		}

		// Garante response null para CALL_TOOL
		if (action === 'CALL_TOOL') response = null;

		return {
			schema_version: obj.schema_version as '2.0',
			action,
			reasoning_intent: obj.reasoning_intent,
			response,
			tool_call,
			guardrails: obj.guardrails,
		};
	});

/**
 * Parseia e valida resposta LLM no contrato AgentDecisionV2.
 * Normaliza desvios com o schema leniente, depois valida com o schema estrito.
 */
export function parseAgentDecisionV2FromLLM(text: string): AgentDecisionV2 {
	let raw: unknown;
	try {
		raw = parseJSONFromLLM(text);
	} catch (error) {
		try {
			sentryMetrics.increment('agent_decision_v2_parse_invalid_total', 1, { stage: 'json_parse' });
		} catch (metricError) {
			loggers.ai.debug({ err: metricError }, 'Falha ao enviar telemetria AgentDecisionV2');
		}
		throw error;
	}

	// Normaliza desvios comuns via schema leniente
	const normalized = LenientAgentDecisionV2Schema.safeParse(raw);
	if (!normalized.success) {
		try {
			sentryMetrics.increment('agent_decision_v2_parse_invalid_total', 1, { stage: 'normalization' });
		} catch (metricError) {
			loggers.ai.debug({ err: metricError }, 'Falha ao enviar telemetria AgentDecisionV2');
		}
		throw new Error('AgentDecisionV2 inválido');
	}

	// Validação estrita (cross-field rules: CALL_TOOL requer tool_call, etc.)
	const validated = AgentDecisionV2Schema.safeParse(normalized.data);
	if (!validated.success) {
		try {
			sentryMetrics.increment('agent_decision_v2_parse_invalid_total', 1, { stage: 'validation' });
		} catch (metricError) {
			loggers.ai.debug({ err: metricError }, 'Falha ao enviar telemetria AgentDecisionV2');
		}
		throw new Error('AgentDecisionV2 inválido');
	}

	try {
		sentryMetrics.increment('agent_decision_v2_parse_valid_total', 1, { action: validated.data.action });
	} catch (metricError) {
		loggers.ai.debug({ err: metricError }, 'Falha ao enviar telemetria AgentDecisionV2');
	}

	return validated.data;
}
