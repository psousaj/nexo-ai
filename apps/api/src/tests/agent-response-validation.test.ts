import { validateAgentResponse } from '@/types';
import { describe, expect, test } from 'vitest';

describe('validateAgentResponse RESPOND truncation', () => {
	test('keeps messages with length <= 700 unchanged', () => {
		const message = 'a'.repeat(700);
		const response = {
			schema_version: '1.0',
			action: 'RESPOND',
			message,
		};

		expect(validateAgentResponse(response)).toBe(true);
		expect(response.message).toBe(message);
		expect(response.message).toHaveLength(700);
	});

	test('truncates messages longer than 700 with ellipsis and final length 700', () => {
		const message = 'b'.repeat(701);
		const response = {
			schema_version: '1.0',
			action: 'RESPOND',
			message,
		};

		expect(validateAgentResponse(response)).toBe(true);
		expect(response.message).toHaveLength(700);
		expect(response.message).toBe(`${'b'.repeat(697)}...`);
	});

	test.each([123, { text: 'oi' }, null])('rejects non-string RESPOND messages (%p)', (message) => {
		const response = {
			schema_version: '1.0',
			action: 'RESPOND',
			message,
		};

		expect(validateAgentResponse(response)).toBe(false);
	});
});
