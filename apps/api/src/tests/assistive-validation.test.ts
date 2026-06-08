import { AssistiveValidator } from '@/core/validation/assistive-validation';
import { describe, expect, it } from 'vitest';

describe('AssistiveValidator', () => {
	describe('validateTurnResult', () => {
		const validator = new AssistiveValidator();

		it('should validate a normal response', () => {
			const result = validator.validateTurnResult({ text: 'Hello, how can I help?' });
			expect(result.valid).toBe(true);
			expect(result.issues).toEqual([]);
		});

		it('should flag empty response', () => {
			const result = validator.validateTurnResult({ text: '', toolCalls: [] });
			expect(result.valid).toBe(false);
			expect(result.issues).toContain('empty_response');
		});

		it('should allow response with tool calls only', () => {
			const result = validator.validateTurnResult({ text: '', toolCalls: ['search'] });
			expect(result.valid).toBe(true);
			expect(result.issues).toEqual([]);
		});

		it('should flag response too long', () => {
			const longText = 'a'.repeat(4001);
			const result = validator.validateTurnResult({ text: longText });
			expect(result.valid).toBe(false);
			expect(result.issues).toContain('response_too_long');
		});

		it('should flag too many tools used', () => {
			const result = validator.validateTurnResult({
				text: 'ok',
				toolsUsed: Array(11).fill('tool'),
			});
			expect(result.valid).toBe(false);
			expect(result.issues).toContain('too_many_tools');
		});
	});

	describe('validateSession', () => {
		const validator = new AssistiveValidator();

		it('should validate a complete session', () => {
			const result = validator.validateSession({ sessionKey: 'abc', createdAt: new Date() });
			expect(result.valid).toBe(true);
			expect(result.issues).toEqual([]);
		});

		it('should flag missing session key', () => {
			const result = validator.validateSession({ createdAt: new Date() });
			expect(result.valid).toBe(false);
			expect(result.issues).toContain('missing_session_key');
		});

		it('should flag missing created at', () => {
			const result = validator.validateSession({ sessionKey: 'abc' });
			expect(result.valid).toBe(false);
			expect(result.issues).toContain('missing_created_at');
		});
	});
});
