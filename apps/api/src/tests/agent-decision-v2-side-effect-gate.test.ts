import { canExecuteAgentDecisionV2Tool } from '@/services/agent-decision-v2-side-effect-gate';
import type { AgentDecisionV2 } from '@/types';
import { describe, expect, test } from 'vitest';

const baseDecision: Omit<AgentDecisionV2, 'tool_call'> = {
	schema_version: '2.0',
	action: 'CALL_TOOL',
	reasoning_intent: {
		category: 'memory_write',
		confidence: 0.9,
		trigger: 'natural_language',
	},
	response: null,
};

describe('AgentDecisionV2 deterministic side-effect gate', () => {
	test('allows side-effecting tool when deterministic_path is true', () => {
		const result = canExecuteAgentDecisionV2Tool({
			...baseDecision,
			tool_call: { name: 'save_note', arguments: { content: 'hello' } },
			guardrails: {
				requires_confirmation: false,
				deterministic_path: true,
			},
		});

		expect(result).toEqual({ allow: true, reason: 'deterministic_path' });
	});

	test('blocks side-effecting tool when deterministic_path is missing', () => {
		const result = canExecuteAgentDecisionV2Tool({
			...baseDecision,
			tool_call: { name: 'save_note', arguments: { content: 'hello' } },
		});

		expect(result).toEqual({ allow: false, reason: 'missing_deterministic_path' });
	});

	test('allows read-only tools even when deterministic_path is false', () => {
		const result = canExecuteAgentDecisionV2Tool({
			...baseDecision,
			reasoning_intent: {
				category: 'memory_read',
				confidence: 0.94,
				trigger: 'natural_language',
			},
			tool_call: { name: 'search_items', arguments: { query: 'inception' } },
			guardrails: {
				requires_confirmation: false,
				deterministic_path: false,
			},
		});

		expect(result).toEqual({ allow: true, reason: 'read_only_tool' });
	});
});
