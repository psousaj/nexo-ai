/**
 * AI SDK Stream With Tools — Wrapper para streamText do AI SDK
 *
 * Thin wrapper que adiciona:
 * - Model reference via ai-sdk-provider (Cloudflare AI Gateway)
 * - OTEL tracing integration
 * - Langfuse span attributes
 */

import { stepCountIs, streamText, type ModelMessage, type StepResult, type StreamTextResult, type ToolSet } from 'ai';
import { getModel } from './ai-sdk-provider';
import { getLangfuse } from '@/services/langfuse';
import { loggers } from '@/utils/logger';
import { getCurrentTraceId, setAttributes, startSpan } from '@nexo/otel/tracing';

export interface StreamWithToolsParams {
	system: string;
	messages: ModelMessage[];
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
export function runAgentStream(params: StreamWithToolsParams): Promise<StreamTextResult<ToolSet, any>> {
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
			stopWhen: stepCountIs(params.maxSteps ?? 5),
			onStepFinish: async (step) => {
				loggers.ai.info(
					{
						finishReason: step.finishReason,
						toolCalls: step.toolCalls?.length ?? 0,
						hasText: !!step.text,
					},
					'Agent step finished',
				);

				setAttributes({
					'agent.step_reason': step.finishReason,
					'agent.tool_calls': step.toolCalls?.length ?? 0,
				});

				if (step.usage) {
					setAttributes({
						'llm.prompt_tokens': step.usage.inputTokens ?? 0,
						'llm.completion_tokens': step.usage.outputTokens ?? 0,
						'llm.total_tokens': step.usage.totalTokens ?? 0,
					});
				}

				if (params.onStepFinish) {
					await params.onStepFinish(step);
				}
			},
		});
	});
}
