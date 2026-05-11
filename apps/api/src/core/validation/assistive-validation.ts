export class AssistiveValidator {
	validateTurnResult(result: any): { valid: boolean; issues: string[] } {
		const issues: string[] = [];

		if (!result.text && !result.toolCalls?.length) {
			issues.push('empty_response');
		}

		if (result.text && result.text.length > 4000) {
			issues.push('response_too_long');
		}

		if (result.toolsUsed?.length > 10) {
			issues.push('too_many_tools');
		}

		return { valid: issues.length === 0, issues };
	}

	validateSession(session: any): { valid: boolean; issues: string[] } {
		const issues: string[] = [];

		if (!session.sessionKey) issues.push('missing_session_key');
		if (!session.createdAt) issues.push('missing_created_at');

		return { valid: issues.length === 0, issues };
	}
}
