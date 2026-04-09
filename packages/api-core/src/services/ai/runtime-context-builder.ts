import { buildAgentPrompt } from "@/config/prompt-builder";
import { conversationService } from "@/services/conversation-service";
import { buildAgentContext } from "@/services/context-builder";
import { userService } from "@/services/user-service";
import type { CoreMessage } from "ai";
import type OpenAI from "openai";

export interface RuntimeHistoryBlock {
  role: "user" | "assistant";
  content: string;
  source: "history" | "current";
}

export interface RuntimeContextBuilderRequest {
  conversationId: string;
  userId: string;
  message: string;
  availableTools: string[];
  sessionKey?: string;
  historyLimit?: number;
}

export interface RuntimeContextBuilderResult {
  assistantName: string;
  systemPrompt: string;
  coreMessages: CoreMessage[];
  openAIMessages: OpenAI.Chat.ChatCompletionMessageParam[];
  historyBlocks: RuntimeHistoryBlock[];
}

export async function buildRuntimeContext(
  request: RuntimeContextBuilderRequest,
): Promise<RuntimeContextBuilderResult> {
  const { assistantName, systemPrompt } = await resolvePromptContext(
    request.userId,
    request.sessionKey,
    request.availableTools,
  );

  const history = await conversationService.getHistory(
    request.conversationId,
    request.historyLimit ?? 10,
  );
  const historyBlocks: RuntimeHistoryBlock[] = history
    .filter(
      (item: any): item is { role: "user" | "assistant"; content: string } => {
        return (
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string"
        );
      },
    )
    .map((item) => ({
      role: item.role,
      content: item.content,
      source: "history" as const,
    }));

  historyBlocks.push({
    role: "user",
    content: request.message,
    source: "current",
  });

  const coreMessages: CoreMessage[] = historyBlocks.map((block) => ({
    role: block.role,
    content: block.content,
  }));

  const openAIMessages: OpenAI.Chat.ChatCompletionMessageParam[] = coreMessages
    .filter(
      (
        message,
      ): message is Extract<CoreMessage, { role: "user" | "assistant" }> =>
        message.role === "user" || message.role === "assistant",
    )
    .map((message) => ({
      role: message.role,
      content:
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content),
    }));

  return {
    assistantName,
    systemPrompt,
    coreMessages,
    openAIMessages,
    historyBlocks,
  };
}

async function resolvePromptContext(
  userId: string,
  sessionKey: string | undefined,
  availableTools: string[],
): Promise<{ assistantName: string; systemPrompt: string }> {
  if (sessionKey) {
    const agentContext = await buildAgentContext(userId, sessionKey);
    const assistantName = agentContext.assistantName || "Nexo";
    const basePrompt = buildAgentPrompt({
      assistantName,
      availableTools,
    }).system;
    return {
      assistantName,
      systemPrompt: agentContext.systemPrompt
        ? `${basePrompt}\n\n# PERSONALIZED CONTEXT\n${agentContext.systemPrompt}`
        : basePrompt,
    };
  }

  const user = await userService.getUserById(userId);
  const assistantName = user?.assistantName || "Nexo";
  return {
    assistantName,
    systemPrompt: buildAgentPrompt({ assistantName, availableTools }).system,
  };
}
