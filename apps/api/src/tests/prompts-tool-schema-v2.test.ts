import {
	AGENT_DECISION_V2_CONTRACT_PROMPT,
	AGENT_SYSTEM_PROMPT_V2,
	getAgentSystemPrompt,
	applyAgentDecisionV2Contract,
} from '@/config/prompts';
import { describe, expect, test } from 'vitest';

describe('prompt contract V2 (TOOL_SCHEMA_V2 hardcoded)', () => {
	test('sempre retorna o prompt V2 (schema 2.0)', () => {
		const prompt = getAgentSystemPrompt('Nexo');

		expect(prompt).toBe(AGENT_SYSTEM_PROMPT_V2);
		expect(prompt).toContain('"schema_version": "2.0"');
		expect(prompt).toContain('"reasoning_intent"');
		expect(prompt).toContain('"tool_call"');
		expect(prompt).toContain('guardrails.deterministic_path MUST be true');
		expect(prompt).toContain('NO TEXT BEFORE OR AFTER JSON');
	});

	test('substitui nome do assistente corretamente', () => {
		const prompt = getAgentSystemPrompt('HAL-9000');
		expect(prompt).toContain('You are HAL-9000,');
	});

	test('applyAgentDecisionV2Contract sempre adiciona o contrato ao prompt', () => {
		const dynamicPrompt = 'You are Custom Nexo.';

		const result = applyAgentDecisionV2Contract(dynamicPrompt);
		expect(result).toContain(dynamicPrompt);
		expect(result).toContain(AGENT_DECISION_V2_CONTRACT_PROMPT);
	});
});
