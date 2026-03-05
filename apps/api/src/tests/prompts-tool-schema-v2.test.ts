import {
	AGENT_DECISION_V2_CONTRACT_PROMPT,
	AGENT_SYSTEM_PROMPT,
	getAgentSystemPrompt,
	applyAgentDecisionV2Contract,
} from '@/config/prompts';
import { describe, expect, test } from 'vitest';

describe('prompt contract rollout (TOOL_SCHEMA_V2)', () => {
	test('keeps legacy prompt by default when v2 flag is off', () => {
		const prompt = getAgentSystemPrompt('Nexo', false);

		expect(prompt).toBe(AGENT_SYSTEM_PROMPT);
		expect(prompt).toContain('"schema_version": "1.0"');
		expect(prompt).not.toContain('"schema_version": "2.0"');
		expect(prompt).not.toContain('reasoning_intent');
	});

	test('uses strict AgentDecisionV2 contract when v2 flag is on', () => {
		const prompt = getAgentSystemPrompt('Nexo', true);

		expect(prompt).toContain('"schema_version": "2.0"');
		expect(prompt).toContain('"reasoning_intent"');
		expect(prompt).toContain('"tool_call"');
		expect(prompt).toContain('guardrails.deterministic_path MUST be true');
		expect(prompt).toContain('NO TEXT BEFORE OR AFTER JSON');
	});

	test('appends v2 contract to dynamic prompts only when enabled', () => {
		const dynamicPrompt = 'You are Custom Nexo.';

		expect(applyAgentDecisionV2Contract(dynamicPrompt, false)).toBe(dynamicPrompt);
		expect(applyAgentDecisionV2Contract(dynamicPrompt, true)).toContain(AGENT_DECISION_V2_CONTRACT_PROMPT);
	});
});
