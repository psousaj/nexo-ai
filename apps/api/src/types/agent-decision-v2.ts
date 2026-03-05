export type AgentDecisionAction = 'CALL_TOOL' | 'RESPOND' | 'NOOP';

export type AgentDecisionCategory = 'conversation' | 'memory_write' | 'memory_read' | 'system';

export type AgentDecisionTrigger = 'slash_command' | 'natural_language' | 'audio_transcript' | 'image_ocr' | 'mixed';

export interface AgentDecisionV2 {
	schema_version: '2.0';
	action: AgentDecisionAction;
	reasoning_intent: {
		category: AgentDecisionCategory;
		confidence: number;
		trigger: AgentDecisionTrigger;
	};
	response?: {
		text: string;
		tone_profile: string;
	} | null;
	tool_call?: {
		name: string;
		arguments: Record<string, unknown>;
		idempotency_key?: string;
	} | null;
	guardrails?: {
		requires_confirmation: boolean;
		deterministic_path: boolean;
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

const ALLOWED_ACTIONS: AgentDecisionAction[] = ['CALL_TOOL', 'RESPOND', 'NOOP'];
const ALLOWED_CATEGORIES: AgentDecisionCategory[] = ['conversation', 'memory_write', 'memory_read', 'system'];
const ALLOWED_TRIGGERS: AgentDecisionTrigger[] = [
	'slash_command',
	'natural_language',
	'audio_transcript',
	'image_ocr',
	'mixed',
];

/**
 * Strict validator for the pivot contract.
 * This keeps runtime deterministic for side-effecting operations while allowing free conversation.
 */
export function isValidAgentDecisionV2(payload: unknown): payload is AgentDecisionV2 {
	if (!isRecord(payload)) return false;
	if (payload.schema_version !== '2.0') return false;
	if (!ALLOWED_ACTIONS.includes(payload.action as AgentDecisionAction)) return false;

	if (!isRecord(payload.reasoning_intent)) return false;
	if (!ALLOWED_CATEGORIES.includes(payload.reasoning_intent.category as AgentDecisionCategory)) return false;
	if (!ALLOWED_TRIGGERS.includes(payload.reasoning_intent.trigger as AgentDecisionTrigger)) return false;
	if (typeof payload.reasoning_intent.confidence !== 'number') return false;
	if (payload.reasoning_intent.confidence < 0 || payload.reasoning_intent.confidence > 1) return false;

	if (payload.action === 'CALL_TOOL') {
		if (!isRecord(payload.tool_call)) return false;
		if (typeof payload.tool_call.name !== 'string' || payload.tool_call.name.trim().length === 0) return false;
		if (!isRecord(payload.tool_call.arguments)) return false;
		if (payload.response !== null && payload.response !== undefined) return false;
	}

	if (payload.action === 'RESPOND') {
		if (!isRecord(payload.response)) return false;
		if (typeof payload.response.text !== 'string' || payload.response.text.trim().length === 0) return false;
		if (typeof payload.response.tone_profile !== 'string' || payload.response.tone_profile.trim().length === 0)
			return false;
		if (payload.tool_call !== null && payload.tool_call !== undefined) return false;
	}

	if (payload.action === 'NOOP') {
		if (payload.response !== null && payload.response !== undefined) return false;
		if (payload.tool_call !== null && payload.tool_call !== undefined) return false;
	}

	if (payload.guardrails !== undefined) {
		if (!isRecord(payload.guardrails)) return false;
		if (typeof payload.guardrails.requires_confirmation !== 'boolean') return false;
		if (typeof payload.guardrails.deterministic_path !== 'boolean') return false;
	}

	return true;
}
