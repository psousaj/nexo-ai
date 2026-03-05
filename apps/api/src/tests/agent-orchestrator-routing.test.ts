import type { ConversationState } from '@/types';
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

describe('decideAgentAction', () => {
	test('routes greet/thank to LLM when conversation freedom is enabled', () => {
		const greetIntent = makeIntent({ intent: 'casual_chat', action: 'greet' });
		const thankIntent = makeIntent({ intent: 'casual_chat', action: 'thank' });

		expect(decideAgentAction(greetIntent, idleState, true)).toBe('handle_with_llm');
		expect(decideAgentAction(thankIntent, idleState, true)).toBe('handle_with_llm');
	});

	test('routes greet/thank to deterministic casual handler when conversation freedom is disabled', () => {
		const greetIntent = makeIntent({ intent: 'casual_chat', action: 'greet' });
		const thankIntent = makeIntent({ intent: 'casual_chat', action: 'thank' });

		expect(decideAgentAction(greetIntent, idleState, false)).toBe('handle_casual');
		expect(decideAgentAction(thankIntent, idleState, false)).toBe('handle_casual');
	});

	test('routes casual_chat fallback by flag state', () => {
		const fallbackCasualIntent = makeIntent({ intent: 'casual_chat', action: 'unknown' });

		expect(decideAgentAction(fallbackCasualIntent, idleState, true)).toBe('handle_with_llm');
		expect(decideAgentAction(fallbackCasualIntent, idleState, false)).toBe('handle_casual');
	});

	test('keeps deterministic side-effect flow unchanged', () => {
		const deleteIntent = makeIntent({ intent: 'delete_content', action: 'delete_all' });
		expect(decideAgentAction(deleteIntent, idleState, true)).toBe('handle_delete_all');
		expect(decideAgentAction(deleteIntent, idleState, false)).toBe('handle_delete_all');
	});
});
