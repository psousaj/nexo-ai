/**
 * AI SDK Stream With Tools — Wrapper para streamText do AI SDK
 *
 * Thin wrapper que adiciona:
 * - Model reference via ai-sdk-provider (Cloudflare AI Gateway)
 * - OTEL tracing integration
 * - Langfuse span attributes
 */

import { streamText, type CoreMessage, type StepResult, type ToolSet } from 'ai';
import { getModel } from './ai-sdk-provider';
import { getLangfuse } from '@/services/langfuse';
import { loggers } from '@/utils/logger';
import { getCurrentTraceId, setAttributes, startSpan } from '@nexo/otel/tracing';

export interface StreamWithToolsParams {
	system: string;
	messages: CoreMessage[];
	tools: ToolSet;
	maxSteps?: number;
	onStepFinish?: (step: StepResult<ToolSet>) => void | Promise<void>;
	modelId?: string;
}

/**
 * Executa streamText com tools nativos do AI SDK.
 * O LLM pode invocar tools em loop (maxSteps) até responder com texto final.
 *
 * Uso no orchestrator:
 * ```ts
 * const result = await runAgentStream({ system, messages, tools, maxSteps: 5 });
 * const text = await result.text; // aguarda texto final
 * ```
 */
export function runAgentStream(params: StreamWithToolsParams) {
	return startSpan('agent.stream', (_span) => {
		setAttributes({
			'agent.message_count': params.messages.length,
			'agent.system_prompt_length': params.system.length,
			'agent.max_steps': params.maxSteps ?? 5,
		});

		loggers.ai.info(
			{
				messageCount: params.messages.length,
				maxSteps: params.maxSteps ?? 5,
			},
			'Starting agent stream',
		);

		const langfuse = getLangfuse();
		const traceId = getCurrentTraceId();

		if (langfuse) {
			langfuse.trace({
				name: 'agent_stream',
				id: traceId,
				input: params.messages[params.messages.length - 1],
			});
		}

		return streamText({
			model: getModel(params.modelId),
			system: params.system,
			messages: params.messages,
			tools: params.tools,
			maxSteps: params.maxSteps ?? 5,
			onStepFinish: async (step) => {
				loggers.ai.info(
					{
						stepType: step.stepType,
						toolCalls: step.toolCalls?.length ?? 0,
						hasText: !!step.text,
					},
					'Agent step finished',
				);

				setAttributes({
					'agent.step_type': step.stepType,
					'agent.tool_calls': step.toolCalls?.length ?? 0,
				});

				if (step.usage) {
					setAttributes({
						'llm.prompt_tokens': step.usage.promptTokens,
						'llm.completion_tokens': step.usage.completionTokens,
						'llm.total_tokens': step.usage.totalTokens,
					});
				}

				if (params.onStepFinish) {
					await params.onStepFinish(step);
				}
			},
		});
	});
}
