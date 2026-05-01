export type RuntimeStopReason =
  | "tool_use"
  | "end_turn"
  | "max_tokens"
  | "stop_sequence"
  | "refusal"
  | "unknown";

export type RuntimeInternalTaskName =
  | "intent_classification"
  | "enrichment_dispatch"
  | "embedding_generation"
  | "context_injection";

export type RuntimeInternalTaskStatus = "started" | "completed" | "failed";

export interface RuntimeUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface RuntimeGatewayHeaders {
  cfAigLogId?: string;
  cfAigEventId?: string;
  cfAigModel?: string;
  cfAigProvider?: string;
  cfAiReqId?: string;
}

export interface RuntimeAssistantTextBlock {
  type: "assistant_text";
  text: string;
}

export interface RuntimeToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface RuntimeToolResultBlock {
  type: "tool_result";
  toolUseId: string;
  content: unknown;
  isError?: boolean;
}

export interface RuntimeInternalTaskBlock {
  type: "internal_task";
  task: RuntimeInternalTaskName;
  async: boolean;
  status: RuntimeInternalTaskStatus;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface RuntimeErrorBlock {
  type: "error";
  code: string;
  message: string;
  retryable: boolean;
}

export type RuntimeRoundBlock =
  | RuntimeAssistantTextBlock
  | RuntimeToolUseBlock
  | RuntimeToolResultBlock
  | RuntimeInternalTaskBlock
  | RuntimeErrorBlock;

export interface RuntimeRoundContext {
  conversationId: string;
  userId: string;
  model: string;
  gatewayBaseUrl: string;
}

export interface RuntimeRound {
  context: RuntimeRoundContext;
  blocks: RuntimeRoundBlock[];
  stopReason: RuntimeStopReason;
  usage?: RuntimeUsage;
  gatewayHeaders?: RuntimeGatewayHeaders;
}

export function createRuntimeRound(context: RuntimeRoundContext): RuntimeRound {
  return {
    context,
    blocks: [],
    stopReason: "unknown",
  };
}

export function addRuntimeBlock(
  round: RuntimeRound,
  block: RuntimeRoundBlock,
): RuntimeRound {
  round.blocks.push(block);
  return round;
}

export function mapOpenAIFinishReasonToRuntimeStopReason(
  finishReason: string | null | undefined,
): RuntimeStopReason {
  if (finishReason === "tool_calls") return "tool_use";
  if (finishReason === "stop") return "end_turn";
  if (finishReason === "length") return "max_tokens";
  if (finishReason === "content_filter") return "refusal";
  return "unknown";
}

export function buildRuntimeUsageFromOpenAI(usage?: {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}): RuntimeUsage {
  return {
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
  };
}

export function normalizeGatewayHeaders(
  headers?: Record<string, string | null | undefined>,
): RuntimeGatewayHeaders | undefined {
  if (!headers) return undefined;

  const normalized: RuntimeGatewayHeaders = {
    cfAigLogId: headers["cf-aig-log-id"] ?? undefined,
    cfAigEventId: headers["cf-aig-event-id"] ?? undefined,
    cfAigModel: headers["cf-aig-model"] ?? undefined,
    cfAigProvider: headers["cf-aig-provider"] ?? undefined,
    cfAiReqId: headers["cf-ai-req-id"] ?? undefined,
  };

  const hasAnyHeader = Object.values(normalized).some(Boolean);
  return hasAnyHeader ? normalized : undefined;
}
