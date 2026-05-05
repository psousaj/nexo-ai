/**
 * Prompt Sanitizer — Security Layer for System Prompt Injection Prevention
 *
 * Detects and neutralizes prompt injection patterns, role confusion,
 * and invisible Unicode attacks before they reach the LLM.
 *
 * Patterns covered:
 * - Instruction override ("ignore previous", "disregard", "forget")
 * - Role injection ("system:", "assistant:", "user:" at line start)
 * - Delimiter confusion ("```", XML tags, fake markdown)
 * - Unicode invisible characters (zero-width, bidi, homoglyphs)
 * - Escape sequence attacks
 */

import { loggers } from '@/utils/logger';

export interface SanitizationResult {
	cleanText: string;
	wasSanitized: boolean;
	detectedPatterns: string[];
}

// ── Threat Patterns ──────────────────────────────────────────────────────────

const THREAT_PATTERNS = [
	// Instruction override
	{ name: 'ignore_previous', regex: /ignore\s+(all\s+)?(previous|prior)\s+(instructions?|prompts?)/gi },
	{ name: 'disregard_above', regex: /disregard\s+(everything\s+above|above\s+instructions?)/gi },
	{ name: 'forget_prompt', regex: /forget\s+(the\s+)?(prompt|instructions?|context)/gi },
	{ name: 'new_instructions', regex: /(new|updated?)\s+instructions?:/gi },
	{ name: 'override_system', regex: /override\s+(system|previous)\s+(prompt|instructions?)/gi },
	{ name: 'start_over', regex: /(start\s+over|begin\s+anew|reset\s+context)/gi },

	// Role injection
	{ name: 'role_system', regex: /^\s*system\s*:\s*/gim },
	{ name: 'role_assistant', regex: /^\s*assistant\s*:\s*/gim },
	{ name: 'role_user', regex: /^\s*user\s*:\s*/gim },
	{ name: 'role_developer', regex: /^\s*developer\s*:\s*/gim },
	{ name: 'role_human', regex: /^\s*human\s*:\s*/gim },
	{ name: 'role_ai', regex: /^\s*ai\s*:\s*/gim },

	// Delimiter / markdown confusion
	{ name: 'fake_codeblock', regex: /```\s*(system|prompt|instructions?|yaml|json)/gi },
	{ name: 'xml_tags', regex: /<\s*(system|prompt|instructions?|role)\s*>/gi },
	{ name: 'fake_header', regex: /#+\s*(system|prompt|instructions?)\s*\n/gi },

	// Jailbreak hints
	{ name: 'jailbreak_dan', regex: /(dan|dude|developer mode|anti\-?guard)/gi },
	{ name: 'leak_prompt', regex: /(show|print|repeat|echo)\s+(the\s+)?(system\s+)?(prompt|instructions?)/gi },
] as const;

// ── Unicode Invisible Characters ─────────────────────────────────────────────

const INVISIBLE_UNICODE_RANGES: Array<{ name: string; pattern: RegExp }> = [
	{ name: 'zero_width_space', pattern: /\u200B/g },
	{ name: 'zero_width_non_joiner', pattern: /\u200C/g },
	{ name: 'zero_width_joiner', pattern: /\u200D/g },
	{ name: 'zero_width_no_break_space', pattern: /\uFEFF/g },
	{ name: 'left_to_right_mark', pattern: /\u200E/g },
	{ name: 'right_to_left_mark', pattern: /\u200F/g },
	{ name: 'left_to_right_override', pattern: /\u202D/g },
	{ name: 'right_to_left_override', pattern: /\u202E/g },
	{ name: 'pop_directional_formatting', pattern: /\u202C/g },
	{ name: 'invisible_separator', pattern: /\u2063/g },
	{ name: 'word_joiner', pattern: /\u2060/g },
	{ name: 'function_application', pattern: /\u2061/g },
	{ name: 'bidi_embedding', pattern: /[\u202A-\u202E]/g },
];

// ── Sanitization Logic ───────────────────────────────────────────────────────

/**
 * Detect threat patterns in text and return which ones matched
 */
export function detectThreats(text: string): string[] {
	const detected: string[] = [];

	for (const threat of THREAT_PATTERNS) {
		if (threat.regex.test(text)) {
			detected.push(threat.name);
		}
		// Reset regex state (global flag)
		threat.regex.lastIndex = 0;
	}

	// Check invisible Unicode
	for (const invisible of INVISIBLE_UNICODE_RANGES) {
		if (invisible.pattern.test(text)) {
			detected.push(invisible.name);
		}
		invisible.pattern.lastIndex = 0;
	}

	return detected;
}

/**
 * Neutralize detected threat patterns in text
 */
export function neutralizeThreats(text: string): string {
	let clean = text;

	// Neutralize role prefixes by breaking the pattern
	clean = clean.replace(/^\s*(system|assistant|user|developer|human|ai)\s*:\s*/gim, '[$1] ');

	// Neutralize markdown/codeblock confusion
	clean = clean.replace(/```\s*(system|prompt|instructions?)/gi, '`\\n\\n`$1');
	clean = clean.replace(/<\s*(system|prompt|instructions?)\s*>/gi, '‹$1›');

	// Break up dangerous phrases with zero-width space (ironic but effective)
	clean = clean.replace(/ignore\s+(all\s+)?(previous|prior)\s+(instructions?|prompts?)/gi, 'ig­nore $2 $3');
	clean = clean.replace(/disregard\s+(everything\s+above|above\s+instructions?)/gi, 'dis­regard $1');
	clean = clean.replace(/forget\s+(the\s+)?(prompt|instructions?|context)/gi, 'for­get $2');

	return clean;
}

/**
 * Remove all invisible Unicode characters
 */
export function stripInvisibleUnicode(text: string): string {
	let clean = text;
	for (const invisible of INVISIBLE_UNICODE_RANGES) {
		clean = clean.replace(invisible.pattern, '');
	}
	return clean;
}

/**
 * Main sanitization entry point
 *
 * Sanitizes user-controlled text before it enters the system prompt.
 * Logs attempts but never blocks — cleans instead.
 */
export function sanitizePromptInput(text: string, context?: { field: string; userId?: string }): SanitizationResult {
	const detectedPatterns = detectThreats(text);

	let cleanText = text;

	if (detectedPatterns.length > 0) {
		cleanText = neutralizeThreats(cleanText);
		cleanText = stripInvisibleUnicode(cleanText);

		loggers.context.warn(
			{
				userId: context?.userId,
				field: context?.field,
				patterns: detectedPatterns,
				originalLength: text.length,
				cleanLength: cleanText.length,
			},
			'🛡️ Prompt injection attempt detected and sanitized',
		);
	}

	return {
		cleanText,
		wasSanitized: detectedPatterns.length > 0,
		detectedPatterns,
	};
}

/**
 * Batch sanitize all profile fields before injecting into system prompt
 */
export function sanitizeAgentProfileFields(fields: {
	soulContent?: string | null;
	identityContent?: string | null;
	memoryContent?: string | null;
	agentsContent?: string | null;
	userContent?: string | null;
	toolsContent?: string | null;
}, userId?: string): {
	soulContent?: string;
	identityContent?: string;
	memoryContent?: string;
	agentsContent?: string;
	userContent?: string;
	toolsContent?: string;
	wasSanitized: boolean;
	detectedPatterns: string[];
} {
	const fieldNames = ['soulContent', 'identityContent', 'memoryContent', 'agentsContent', 'userContent', 'toolsContent'] as const;
	const result: Record<string, string | undefined> = {};
	let anySanitized = false;
	const allPatterns: string[] = [];

	for (const field of fieldNames) {
		const value = fields[field];
		if (value) {
			const sanitized = sanitizePromptInput(value, { field, userId });
			result[field] = sanitized.cleanText;
			if (sanitized.wasSanitized) {
				anySanitized = true;
				allPatterns.push(...sanitized.detectedPatterns);
			}
		}
	}

	return {
		...result,
		wasSanitized: anySanitized,
		detectedPatterns: [...new Set(allPatterns)],
	};
}