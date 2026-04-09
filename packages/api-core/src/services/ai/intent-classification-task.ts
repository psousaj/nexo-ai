import {
  type IntentResult,
  intentClassifier,
} from "@/services/intent-classifier";
import { loggers } from "@/utils/logger";
import type { RuntimeInternalTaskBlock } from "./runtime-contract";

export type IntentClassificationPhase = "main" | "off_topic_reentry";

export interface IntentClassificationTaskRequest {
  message: string;
  phase?: IntentClassificationPhase;
}

export interface IntentClassificationTaskResult {
  intent: IntentResult;
  block: RuntimeInternalTaskBlock;
  durationMs: number;
}

export async function executeIntentClassificationTask(
  request: IntentClassificationTaskRequest,
): Promise<IntentClassificationTaskResult> {
  const start = performance.now();
  const phase = request.phase ?? "main";

  try {
    const intent = await intentClassifier.classify(request.message);
    const durationMs = Math.round(performance.now() - start);

    return {
      intent,
      durationMs,
      block: {
        type: "internal_task",
        task: "intent_classification",
        async: false,
        status: "completed",
        metadata: {
          phase,
          intent: intent.intent,
          action: intent.action,
          confidence: intent.confidence,
          durationMs,
        },
      },
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    const errorMessage = error instanceof Error ? error.message : String(error);

    loggers.ai.error(
      { err: error, phase },
      "❌ Falha na tarefa de intent classification, aplicando fallback contratual",
    );

    return {
      intent: {
        intent: "unknown",
        action: "unknown",
        confidence: 0,
      },
      durationMs,
      block: {
        type: "internal_task",
        task: "intent_classification",
        async: false,
        status: "failed",
        metadata: {
          phase,
          durationMs,
        },
        error: errorMessage,
      },
    };
  }
}
