import { describe, expect, test, vi } from 'vitest';
import { sentryMetrics } from '@/sentry';
import {
	isValidAgentDecisionV2Response,
	parseAgentDecisionV2FromLLM,
	parseJSONFromLLM,
} from '@/utils/json-parser';

describe('json-parser AgentDecisionV2 helpers', () => {
	test('parses valid AgentDecisionV2 from markdown json', () => {
		const output = parseAgentDecisionV2FromLLM(`\`\`\`json
{
  "schema_version": "2.0",
  "action": "CALL_TOOL",
  "reasoning_intent": {
    "category": "memory_write",
    "confidence": 0.93,
    "trigger": "natural_language"
  },
  "tool_call": {
    "name": "save_note",
    "arguments": {
      "content": "comprar café"
    }
  },
  "response": null
}
\`\`\``);

		expect(output.action).toBe('CALL_TOOL');
		expect(output.tool_call?.name).toBe('save_note');
		expect(isValidAgentDecisionV2Response(output)).toBe(true);
	});

	test('parses valid AgentDecisionV2 raw json', () => {
		const output = parseAgentDecisionV2FromLLM(
			'{"schema_version":"2.0","action":"RESPOND","reasoning_intent":{"category":"conversation","confidence":0.8,"trigger":"natural_language"},"response":{"text":"ok","tone_profile":"friendly"},"tool_call":null}',
		);

		expect(output.action).toBe('RESPOND');
		expect(output.response?.text).toBe('ok');
	});

	test('throws explicit error for invalid AgentDecisionV2 contract', () => {
		expect(() =>
			parseAgentDecisionV2FromLLM(
				'{"schema_version":"2.1","action":"RESPOND","reasoning_intent":{"category":"conversation","confidence":0.8,"trigger":"natural_language"},"response":{"text":"ok","tone_profile":"friendly"},"tool_call":null}',
			),
		).toThrowError('AgentDecisionV2 inválido');
	});

	test('keeps parseJSONFromLLM backward compatible for generic json', () => {
		const output = parseJSONFromLLM('{"ok":true,"count":1}');
		expect(output).toEqual({ ok: true, count: 1 });
	});

	test('throws explicit error on non-json input', () => {
		expect(() => parseAgentDecisionV2FromLLM('isso não é json')).toThrowError('Resposta não é JSON');
	});

	test('throws explicit error on malformed json', () => {
		expect(() => parseAgentDecisionV2FromLLM('{"schema_version":')).toThrowError('JSON inválido');
	});

	test('throws explicit error for fallback/error message', () => {
		expect(() => parseAgentDecisionV2FromLLM('⚠️ falha ao processar')).toThrowError('Resposta é mensagem de erro');
	});

	test('emits valid parse metric with action tag', () => {
		const incrementSpy = vi.spyOn(sentryMetrics, 'increment').mockImplementation(() => undefined);

		parseAgentDecisionV2FromLLM(
			'{"schema_version":"2.0","action":"NOOP","reasoning_intent":{"category":"system","confidence":1,"trigger":"mixed"},"response":null,"tool_call":null}',
		);

		expect(incrementSpy).toHaveBeenCalledWith('agent_decision_v2_parse_valid_total', 1, { action: 'NOOP' });
		incrementSpy.mockRestore();
	});

	test('emits invalid parse metric for validation failures', () => {
		const incrementSpy = vi.spyOn(sentryMetrics, 'increment').mockImplementation(() => undefined);

		expect(() =>
			parseAgentDecisionV2FromLLM(
				'{"schema_version":"2.1","action":"RESPOND","reasoning_intent":{"category":"conversation","confidence":0.8,"trigger":"natural_language"},"response":{"text":"ok","tone_profile":"friendly"},"tool_call":null}',
			),
		).toThrowError('AgentDecisionV2 inválido');

		expect(incrementSpy).toHaveBeenCalledWith('agent_decision_v2_parse_invalid_total', 1, { stage: 'validation' });
		incrementSpy.mockRestore();
	});

	test('emits invalid parse metric for json parse failures', () => {
		const incrementSpy = vi.spyOn(sentryMetrics, 'increment').mockImplementation(() => undefined);

		expect(() => parseAgentDecisionV2FromLLM('isso não é json')).toThrowError('Resposta não é JSON');

		expect(incrementSpy).toHaveBeenCalledWith('agent_decision_v2_parse_invalid_total', 1, { stage: 'json_parse' });
		incrementSpy.mockRestore();
	});
});
