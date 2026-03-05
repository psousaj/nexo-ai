import { validateAgentResponse, type ConversationState } from '@/types';
import { describe, expect, test } from 'vitest';
import { decideAgentAction } from '../services/agent-action-routing';
import type { IntentResult } from '../services/intent-classifier';

const idleState: ConversationState = 'idle';

function makeIntent(overrides: Partial<IntentResult>): IntentResult {
return {
intent: 'unknown',
action: 'unknown',
confidence: 0.9,
...overrides,
};
}

type SimulatedResult = {
route: string;
validatedResponse?: { schema_version: string; action: 'RESPOND'; message: string };
};

function simulateGuardrailFlow(params: {
intent: IntentResult;
conversationFree: boolean;
llmResponseText?: string;
}): SimulatedResult {
const route = decideAgentAction(params.intent, idleState, params.conversationFree);

if (route !== 'handle_with_llm') {
return { route };
}

const response = {
schema_version: '1.0',
action: 'RESPOND' as const,
message: params.llmResponseText ?? 'ok',
};

const isValid = validateAgentResponse(response);
expect(isValid).toBe(true);

return {
route,
validatedResponse: response,
};
}

describe('M1 conversational freedom guardrails (integration)', () => {
test('casual chat routes via LLM when CONVERSATION_FREE=true', () => {
const result = simulateGuardrailFlow({
intent: makeIntent({ intent: 'casual_chat', action: 'greet' }),
conversationFree: true,
llmResponseText: 'Oi! Como posso ajudar?',
});

expect(result.route).toBe('handle_with_llm');
expect(result.validatedResponse?.message).toBe('Oi! Como posso ajudar?');
});

test('casual chat uses deterministic fallback when CONVERSATION_FREE=false', () => {
const result = simulateGuardrailFlow({
intent: makeIntent({ intent: 'casual_chat', action: 'thank' }),
conversationFree: false,
});

expect(result.route).toBe('handle_casual');
expect(result.validatedResponse).toBeUndefined();
});

test.each([true, false])(
'deterministic side-effect intents remain deterministic regardless of CONVERSATION_FREE=%s',
(conversationFree) => {
const deleteResult = simulateGuardrailFlow({
intent: makeIntent({ intent: 'delete_content', action: 'delete_all' }),
conversationFree,
});
const searchResult = simulateGuardrailFlow({
intent: makeIntent({ intent: 'search_content', action: 'search', entities: { query: 'matrix' } }),
conversationFree,
});

expect(deleteResult.route).toBe('handle_delete_all');
expect(searchResult.route).toBe('handle_search');
},
);

test('enforces short-response policy for RESPOND length guard', () => {
const result = simulateGuardrailFlow({
intent: makeIntent({ intent: 'casual_chat', action: 'greet' }),
conversationFree: true,
llmResponseText: 'x'.repeat(710),
});

expect(result.route).toBe('handle_with_llm');
expect(result.validatedResponse?.message).toHaveLength(700);
expect(result.validatedResponse?.message.endsWith('...')).toBe(true);
});
});
