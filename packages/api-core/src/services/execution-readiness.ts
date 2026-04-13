import type {
  AmbiguityAnalysisResult,
  ToneAnalysisResult,
} from "@/services/message-analysis/types/analysis-result.types";
import type { ConversationState } from "@/types";
import type { IntentResult } from "./intent-classifier";

const READINESS_CONFIDENCE_THRESHOLD = 0.9;
const SEARCH_MAX_QUERY_LENGTH = 80;
const SEARCH_MAX_QUERY_WORDS = 7;

const SAFE_DETERMINISTIC_ACTIONS = new Set<IntentResult["action"]>([
  "delete_all",
  "delete_item",
  "delete_selected",
  "confirm",
  "deny",
]);

export interface ExecutionReadinessInput {
  state: ConversationState;
  intent: IntentResult;
  tone: ToneAnalysisResult;
  ambiguity: AmbiguityAnalysisResult;
}

export interface ExecutionReadinessResult {
  allowDirectExecution: boolean;
  reasons: string[];
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function evaluateExecutionReadiness(
  input: ExecutionReadinessInput,
): ExecutionReadinessResult {
  if (input.state !== "idle") {
    return { allowDirectExecution: true, reasons: [] };
  }

  if (SAFE_DETERMINISTIC_ACTIONS.has(input.intent.action)) {
    return { allowDirectExecution: true, reasons: [] };
  }

  const isSearchFlow =
    input.intent.action === "search" || input.intent.action === "list_all";
  const isSaveFlow = input.intent.action === "save";

  if (!isSearchFlow && !isSaveFlow) {
    return { allowDirectExecution: true, reasons: [] };
  }

  const reasons: string[] = [];

  if (input.intent.confidence < READINESS_CONFIDENCE_THRESHOLD) {
    reasons.push("low_confidence");
  }

  if (input.tone.isQuestion || input.tone.tone === "polite_request") {
    reasons.push("conversational_tone");
  }

  if (input.intent.action === "search") {
    const query = input.intent.entities?.query?.trim();

    if (!query) {
      reasons.push("missing_search_query");
    } else {
      const queryWords = countWords(query);

      if (query.length > SEARCH_MAX_QUERY_LENGTH) {
        reasons.push("search_query_too_long");
      }

      if (input.ambiguity.isAmbiguous && queryWords >= SEARCH_MAX_QUERY_WORDS) {
        reasons.push("ambiguous_query_shape");
      }
    }
  }

  if (input.intent.action === "save") {
    const hasQuery = Boolean(input.intent.entities?.query?.trim());
    const hasUrl = Boolean(input.intent.entities?.url?.trim());
    const refersToPrevious = Boolean(input.intent.entities?.refersToPrevious);

    if (!hasQuery && !hasUrl && !refersToPrevious) {
      reasons.push("missing_save_payload");
    }
  }

  return {
    allowDirectExecution: reasons.length === 0,
    reasons,
  };
}
