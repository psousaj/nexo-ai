import { evaluateExecutionReadiness } from '@/services/execution-readiness';
import type { IntentResult } from '@/services/intent-classifier';
import type {
	AmbiguityAnalysisResult,
	ToneAnalysisResult,
} from '@/services/message-analysis/types/analysis-result.types';
import type { ConversationState } from '@/types';
import { describe, expect, test } from 'vitest';

function makeIntent(overrides: Partial<IntentResult>): IntentResult {
	return {
		intent: 'unknown',
		action: 'unknown',
		confidence: 0.95,
		entities: {},
		...overrides,
	};
}

function makeTone(overrides: Partial<ToneAnalysisResult>): ToneAnalysisResult {
	return {
		type: 'tone',
		timestamp: new Date(),
		confidence: 0.9,
		tone: 'neutral',
		isPolite: false,
		isQuestion: false,
		hasPermissionRequest: false,
		...overrides,
	};
}

function makeAmbiguity(overrides: Partial<AmbiguityAnalysisResult>): AmbiguityAnalysisResult {
	return {
		type: 'ambiguity',
		timestamp: new Date(),
		confidence: 0.9,
		isAmbiguous: false,
		suggestedAction: 'proceed',
		...overrides,
	};
}

function evaluate(
	intent: IntentResult,
	overrides?: {
		state?: ConversationState;
		tone?: ToneAnalysisResult;
		ambiguity?: AmbiguityAnalysisResult;
	},
) {
	return evaluateExecutionReadiness({
		state: overrides?.state ?? 'idle',
		intent,
		tone: overrides?.tone ?? makeTone({}),
		ambiguity: overrides?.ambiguity ?? makeAmbiguity({}),
	});
}

describe('evaluateExecutionReadiness', () => {
	test('permite execução direta para delete determinístico', () => {
		const result = evaluate(makeIntent({ intent: 'delete_content', action: 'delete_all' }), {
			tone: makeTone({ tone: 'polite_request', isPolite: true }),
			ambiguity: makeAmbiguity({
				isAmbiguous: true,
				reason: 'short_without_command',
				suggestedAction: 'request_clarification',
			}),
		});

		expect(result.allowDirectExecution).toBe(true);
		expect(result.reasons).toEqual([]);
	});

	test('desvia busca com query ambígua longa para LLM', () => {
		const result = evaluate(
			makeIntent({
				intent: 'search_content',
				action: 'search',
				confidence: 0.93,
				entities: {
					query: 'listar tudo que eu quero organizar para salvar depois',
				},
			}),
			{
				ambiguity: makeAmbiguity({
					isAmbiguous: true,
					reason: 'short_without_command',
					suggestedAction: 'request_clarification',
				}),
			},
		);

		expect(result.allowDirectExecution).toBe(false);
		expect(result.reasons).toContain('ambiguous_query_shape');
	});

	test('desvia busca em tom de pergunta para LLM', () => {
		const result = evaluate(
			makeIntent({
				intent: 'search_content',
				action: 'search',
				confidence: 0.96,
				entities: { query: 'filmes de terror' },
			}),
			{
				tone: makeTone({
					tone: 'question',
					isQuestion: true,
				}),
			},
		);

		expect(result.allowDirectExecution).toBe(false);
		expect(result.reasons).toContain('conversational_tone');
	});

	test('permite busca direta quando sinais são claros', () => {
		const result = evaluate(
			makeIntent({
				intent: 'search_content',
				action: 'search',
				confidence: 0.96,
				entities: { query: 'terror' },
			}),
		);

		expect(result.allowDirectExecution).toBe(true);
		expect(result.reasons).toEqual([]);
	});

	test('desvia save sem payload mínimo para LLM', () => {
		const result = evaluate(
			makeIntent({
				intent: 'save_content',
				action: 'save',
				confidence: 0.95,
				entities: {},
			}),
		);

		expect(result.allowDirectExecution).toBe(false);
		expect(result.reasons).toContain('missing_save_payload');
	});
});
