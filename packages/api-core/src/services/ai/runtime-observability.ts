import type { RuntimeGatewayHeaders, RuntimeRound } from "./runtime-contract";

export interface RuntimeRoundsSummary {
  roundCount: number;
  assistantTextBlocks: number;
  toolUseBlocks: number;
  toolResultBlocks: number;
  internalTaskBlocks: number;
  errorBlocks: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  stopReasons: string[];
  gatewayHeaders?: RuntimeGatewayHeaders;
}

export function summarizeRuntimeRounds(
  rounds: RuntimeRound[],
): RuntimeRoundsSummary {
  let assistantTextBlocks = 0;
  let toolUseBlocks = 0;
  let toolResultBlocks = 0;
  let internalTaskBlocks = 0;
  let errorBlocks = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  const stopReasons: string[] = [];
  let gatewayHeaders: RuntimeGatewayHeaders | undefined;

  for (const round of rounds) {
    if (round.stopReason) {
      stopReasons.push(round.stopReason);
    }

    inputTokens += round.usage?.inputTokens ?? 0;
    outputTokens += round.usage?.outputTokens ?? 0;
    totalTokens += round.usage?.totalTokens ?? 0;

    if (round.gatewayHeaders) {
      gatewayHeaders = round.gatewayHeaders;
    }

    for (const block of round.blocks) {
      switch (block.type) {
        case "assistant_text":
          assistantTextBlocks += 1;
          break;
        case "tool_use":
          toolUseBlocks += 1;
          break;
        case "tool_result":
          toolResultBlocks += 1;
          break;
        case "internal_task":
          internalTaskBlocks += 1;
          break;
        case "error":
          errorBlocks += 1;
          break;
      }
    }
  }

  return {
    roundCount: rounds.length,
    assistantTextBlocks,
    toolUseBlocks,
    toolResultBlocks,
    internalTaskBlocks,
    errorBlocks,
    inputTokens,
    outputTokens,
    totalTokens,
    stopReasons,
    gatewayHeaders,
  };
}

export function buildRuntimeObservabilityAttributes(
  summary: RuntimeRoundsSummary,
  prefix = "runtime",
): Record<string, string | number | boolean> {
  const attributes: Record<string, string | number | boolean> = {
    [`${prefix}.rounds`]: summary.roundCount,
    [`${prefix}.assistant_text_blocks`]: summary.assistantTextBlocks,
    [`${prefix}.tool_use_blocks`]: summary.toolUseBlocks,
    [`${prefix}.tool_result_blocks`]: summary.toolResultBlocks,
    [`${prefix}.internal_task_blocks`]: summary.internalTaskBlocks,
    [`${prefix}.error_blocks`]: summary.errorBlocks,
    [`${prefix}.usage.input_tokens`]: summary.inputTokens,
    [`${prefix}.usage.output_tokens`]: summary.outputTokens,
    [`${prefix}.usage.total_tokens`]: summary.totalTokens,
    [`${prefix}.stop_reasons`]: summary.stopReasons.join(","),
  };

  if (summary.gatewayHeaders?.cfAigProvider) {
    attributes[`${prefix}.gateway.provider`] =
      summary.gatewayHeaders.cfAigProvider;
  }

  if (summary.gatewayHeaders?.cfAigModel) {
    attributes[`${prefix}.gateway.model`] = summary.gatewayHeaders.cfAigModel;
  }

  if (summary.gatewayHeaders?.cfAigLogId) {
    attributes[`${prefix}.gateway.log_id`] = summary.gatewayHeaders.cfAigLogId;
  }

  if (summary.gatewayHeaders?.cfAigEventId) {
    attributes[`${prefix}.gateway.event_id`] =
      summary.gatewayHeaders.cfAigEventId;
  }

  if (summary.gatewayHeaders?.cfAiReqId) {
    attributes[`${prefix}.gateway.request_id`] =
      summary.gatewayHeaders.cfAiReqId;
  }

  return attributes;
}
