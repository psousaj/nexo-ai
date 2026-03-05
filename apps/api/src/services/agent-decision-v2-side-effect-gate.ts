import type { AgentDecisionV2 } from '@/types';

const READ_ONLY_TOOLS = new Set([
	'search_items',
	'enrich_movie',
	'enrich_tv_show',
	'enrich_video',
	'get_assistant_name',
	'memory_search',
	'memory_get',
	'daily_log_search',
	'list_calendar_events',
	'list_todos',
]);

export interface AgentDecisionV2ToolGateResult {
	allow: boolean;
	reason: 'not_call_tool' | 'read_only_tool' | 'deterministic_path' | 'missing_deterministic_path';
}

export function canExecuteAgentDecisionV2Tool(decision: AgentDecisionV2): AgentDecisionV2ToolGateResult {
	if (decision.action !== 'CALL_TOOL' || !decision.tool_call) {
		return { allow: true, reason: 'not_call_tool' };
	}

	if (READ_ONLY_TOOLS.has(decision.tool_call.name)) {
		return { allow: true, reason: 'read_only_tool' };
	}

	if (decision.guardrails?.deterministic_path === true) {
		return { allow: true, reason: 'deterministic_path' };
	}

	return { allow: false, reason: 'missing_deterministic_path' };
}
