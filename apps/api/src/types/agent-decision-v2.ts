import { z } from 'zod';

export const AgentDecisionActionSchema = z.enum(['CALL_TOOL', 'RESPOND', 'NOOP']);
export const AgentDecisionCategorySchema = z.enum(['conversation', 'memory_write', 'memory_read', 'system']);
export const AgentDecisionTriggerSchema = z.enum([
	'slash_command',
	'natural_language',
	'audio_transcript',
	'image_ocr',
	'mixed',
]);

export type AgentDecisionAction = z.infer<typeof AgentDecisionActionSchema>;
export type AgentDecisionCategory = z.infer<typeof AgentDecisionCategorySchema>;
export type AgentDecisionTrigger = z.infer<typeof AgentDecisionTriggerSchema>;

export const AgentDecisionV2Schema = z
	.object({
		schema_version: z.literal('2.0'),
		action: AgentDecisionActionSchema,
		reasoning_intent: z.object({
			category: AgentDecisionCategorySchema,
			confidence: z.number().min(0).max(1),
			trigger: AgentDecisionTriggerSchema,
		}),
		response: z
			.object({
				text: z.string().min(1),
				tone_profile: z.string().min(1),
			})
			.nullable()
			.optional(),
		tool_call: z
			.object({
				name: z.string().min(1),
				arguments: z.record(z.unknown()),
				idempotency_key: z.string().optional(),
			})
			.nullable()
			.optional(),
		guardrails: z
			.object({
				requires_confirmation: z.boolean(),
				deterministic_path: z.boolean(),
			})
			.optional(),
	})
	.superRefine((data, ctx) => {
		if (data.action === 'CALL_TOOL') {
			if (!data.tool_call)
				ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'tool_call required for CALL_TOOL', path: ['tool_call'] });
			if (data.response != null)
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'response must be null for CALL_TOOL',
					path: ['response'],
				});
		}
		if (data.action === 'RESPOND') {
			if (!data.response)
				ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'response required for RESPOND', path: ['response'] });
			if (data.tool_call != null)
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'tool_call must be null for RESPOND',
					path: ['tool_call'],
				});
		}
		if (data.action === 'NOOP') {
			if (data.response != null)
				ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'response must be null for NOOP', path: ['response'] });
			if (data.tool_call != null)
				ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'tool_call must be null for NOOP', path: ['tool_call'] });
		}
	});

export type AgentDecisionV2 = z.infer<typeof AgentDecisionV2Schema>;

/**
 * Strict validator for the pivot contract.
 * Backed by AgentDecisionV2Schema — single source of truth.
 */
export function isValidAgentDecisionV2(payload: unknown): payload is AgentDecisionV2 {
	return AgentDecisionV2Schema.safeParse(payload).success;
}
