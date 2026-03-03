import { isValidAgentDecisionV2 } from '@/types';
import { describe, expect, test } from 'vitest';

describe('AgentDecisionV2 validator', () => {
	test('accepts valid CALL_TOOL payload', () => {
		const payload = {
			schema_version: '2.0',
			action: 'CALL_TOOL',
			reasoning_intent: {
				category: 'memory_write',
				confidence: 0.92,
				trigger: 'natural_language',
			},
			tool_call: {
				name: 'save_note',
				arguments: { content: 'comprar leite' },
			},
			response: null,
			guardrails: {
				requires_confirmation: true,
				deterministic_path: true,
			},
		};

		expect(isValidAgentDecisionV2(payload)).toBe(true);
	});

	test('accepts valid RESPOND payload', () => {
		const payload = {
			schema_version: '2.0',
			action: 'RESPOND',
			reasoning_intent: {
				category: 'conversation',
				confidence: 0.88,
				trigger: 'natural_language',
			},
			response: {
				text: 'Claro! Posso te ajudar a guardar isso quando quiser.',
				tone_profile: 'friendly-default',
			},
			tool_call: null,
		};

		expect(isValidAgentDecisionV2(payload)).toBe(true);
	});

	test('accepts valid NOOP payload', () => {
		const payload = {
			schema_version: '2.0',
			action: 'NOOP',
			reasoning_intent: {
				category: 'system',
				confidence: 1,
				trigger: 'mixed',
			},
			response: null,
			tool_call: null,
		};

		expect(isValidAgentDecisionV2(payload)).toBe(true);
	});

	test('rejects CALL_TOOL without tool_call', () => {
		const payload = {
			schema_version: '2.0',
			action: 'CALL_TOOL',
			reasoning_intent: {
				category: 'memory_write',
				confidence: 0.9,
				trigger: 'natural_language',
			},
		};

		expect(isValidAgentDecisionV2(payload)).toBe(false);
	});

	test('rejects RESPOND without response', () => {
		const payload = {
			schema_version: '2.0',
			action: 'RESPOND',
			reasoning_intent: {
				category: 'conversation',
				confidence: 0.9,
				trigger: 'natural_language',
			},
			tool_call: null,
		};

		expect(isValidAgentDecisionV2(payload)).toBe(false);
	});

	test('rejects confidence out of range', () => {
		const payload = {
			schema_version: '2.0',
			action: 'NOOP',
			reasoning_intent: {
				category: 'system',
				confidence: 1.5,
				trigger: 'mixed',
			},
			response: null,
			tool_call: null,
		};

		expect(isValidAgentDecisionV2(payload)).toBe(false);
	});
});
