import { loggers } from "@/utils/logger";
import OpenAI from "openai";
import {
  addRuntimeBlock,
  buildRuntimeUsageFromOpenAI,
  createRuntimeRound,
  mapOpenAIFinishReasonToRuntimeStopReason,
  normalizeGatewayHeaders,
  type RuntimeRound,
} from "./runtime-contract";

export interface OpenAIGatewayTransportConfig {
  accountId: string;
  gatewayId: string;
  apiToken: string;
  model: string;
  basePath?: "compat" | "openai";
  requestTimeoutMs?: number;
  collectLog?: boolean;
}

export interface OpenAIGatewayRequest {
  conversationId: string;
  userId: string;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: OpenAI.Chat.ChatCompletionTool[];
  toolChoice?: OpenAI.Chat.ChatCompletionToolChoiceOption;
  extraHeaders?: Record<string, string>;
}

export interface OpenAIGatewayResponse {
  completion: OpenAI.Chat.Completions.ChatCompletion;
  round: RuntimeRound;
}

type ChatCompletionToolCallWithCustom =
  OpenAI.Chat.Completions.ChatCompletionMessageToolCall & {
    custom?: {
      name?: string;
      input?: unknown;
    };
  };

export class OpenAIGatewayTransport {
  private readonly client: OpenAI;
  private model: string;
  private readonly baseURL: string;
  private readonly collectLog: boolean;

  constructor(config: OpenAIGatewayTransportConfig) {
    const basePath = config.basePath ?? "compat";
    this.baseURL = OpenAIGatewayTransport.buildBaseURL(
      config.accountId,
      config.gatewayId,
      basePath,
    );
    this.model = config.model;
    this.collectLog = config.collectLog ?? true;

    this.client = new OpenAI({
      apiKey: config.apiToken,
      baseURL: this.baseURL,
      timeout: config.requestTimeoutMs ?? 25000,
      maxRetries: 0,
    });

    loggers.ai.info(
      { baseURL: this.baseURL, model: this.model },
      "✅ OpenAI Gateway transport configurado",
    );
  }

  static buildBaseURL(
    accountId: string,
    gatewayId: string,
    basePath: "compat" | "openai" = "compat",
  ): string {
    return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/${basePath}`;
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  getModel(): string {
    return this.model;
  }

  setModel(model: string): void {
    this.model = model;
  }

  async createChatCompletion(
    request: OpenAIGatewayRequest,
  ): Promise<OpenAIGatewayResponse> {
    const model = request.model ?? this.model;
    const runtimeRound = createRuntimeRound({
      conversationId: request.conversationId,
      userId: request.userId,
      model,
      gatewayBaseUrl: this.baseURL,
    });

    const messages = request.systemPrompt
      ? ([
          {
            role: "system",
            content: request.systemPrompt,
          } as OpenAI.Chat.ChatCompletionSystemMessageParam,
          ...request.messages,
        ] as OpenAI.Chat.ChatCompletionMessageParam[])
      : request.messages;

    try {
      const completionRequest = this.client.chat.completions.create(
        {
          model,
          messages,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
          ...(request.tools?.length ? { tools: request.tools } : {}),
          ...(request.toolChoice ? { tool_choice: request.toolChoice } : {}),
        },
        {
          headers: {
            ...(this.collectLog ? { "cf-aig-collect-log": "true" } : {}),
            ...(request.extraHeaders ?? {}),
          },
        },
      );

      let completion: OpenAI.Chat.Completions.ChatCompletion;

      if (typeof (completionRequest as any).withResponse === "function") {
        const responseWithHeaders = await (
          completionRequest as any
        ).withResponse();
        completion =
          responseWithHeaders.data as OpenAI.Chat.Completions.ChatCompletion;

        const headerEntries = responseWithHeaders.response?.headers
          ? Object.fromEntries(responseWithHeaders.response.headers.entries())
          : undefined;

        runtimeRound.gatewayHeaders = normalizeGatewayHeaders(
          headerEntries as
            | Record<string, string | null | undefined>
            | undefined,
        );
      } else {
        completion = await completionRequest;
      }

      if (!completion?.choices || !Array.isArray(completion.choices) || completion.choices.length === 0) {
        addRuntimeBlock(runtimeRound, {
          type: "error",
          code: "empty_completion",
          message: `OpenAI Gateway retornou resposta sem choices (model: ${model}, finish_reason: ${completion?.choices?.[0]?.finish_reason ?? "unknown"})`,
          retryable: true,
        });

        throw Object.assign(
          new Error("OpenAI Gateway: resposta sem choices"),
          { runtimeRound },
        );
      }

      runtimeRound.stopReason = mapOpenAIFinishReasonToRuntimeStopReason(
        completion.choices[0]?.finish_reason,
      );
      runtimeRound.usage = buildRuntimeUsageFromOpenAI(completion.usage);

      const assistantMessage = completion.choices[0]?.message;
      if (!assistantMessage) {
        addRuntimeBlock(runtimeRound, {
          type: "error",
          code: "empty_message",
          message: `OpenAI Gateway: choices[0].message vazio ou nulo (model: ${model})`,
          retryable: true,
        });

        throw Object.assign(
          new Error("OpenAI Gateway: mensagem do assistente vazia"),
          { runtimeRound },
        );
      }
      if (
        typeof assistantMessage?.content === "string" &&
        assistantMessage.content.trim().length > 0
      ) {
        addRuntimeBlock(runtimeRound, {
          type: "assistant_text",
          text: assistantMessage.content,
        });
      }

      for (const toolCall of assistantMessage?.tool_calls ?? []) {
        const resolvedToolCall = this.resolveToolCall(toolCall);
        if (!resolvedToolCall) {
          addRuntimeBlock(runtimeRound, {
            type: "error",
            code: "invalid_tool_call",
            message: "Tool call inválida recebida do provedor OpenAI Gateway.",
            retryable: false,
          });
          continue;
        }

        addRuntimeBlock(runtimeRound, {
          type: "tool_use",
          id: resolvedToolCall.id,
          name: resolvedToolCall.name,
          input: this.safeParseToolArguments(resolvedToolCall.rawInput),
        });
      }

      return {
        completion,
        round: runtimeRound,
      };
    } catch (error) {
      const err = error as any;
      const headers = normalizeGatewayHeaders(
        (err?.responseHeaders ?? {}) as Record<
          string,
          string | null | undefined
        >,
      );
      runtimeRound.gatewayHeaders = headers;

      addRuntimeBlock(runtimeRound, {
        type: "error",
        code: String(err?.statusCode ?? "openai_gateway_error"),
        message: err?.message ?? "Erro de transporte OpenAI Gateway",
        retryable: this.isRetryableError(err),
      });

      throw Object.assign(
        error instanceof Error ? error : new Error(String(error)),
        {
          runtimeRound,
        },
      );
    }
  }

  private resolveToolCall(
    toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
  ): { id: string; name: string; rawInput: unknown } | null {
    const functionCall = (
      toolCall as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall
    ).function;
    if (functionCall && typeof functionCall.name === "string") {
      return {
        id: toolCall.id,
        name: functionCall.name,
        rawInput: functionCall.arguments,
      };
    }

    const customCall = (toolCall as ChatCompletionToolCallWithCustom).custom;
    if (customCall && typeof customCall.name === "string") {
      return {
        id: toolCall.id,
        name: customCall.name,
        rawInput: customCall.input,
      };
    }

    return null;
  }

  private safeParseToolArguments(
    rawArguments: unknown,
  ): Record<string, unknown> {
    if (
      rawArguments &&
      typeof rawArguments === "object" &&
      !Array.isArray(rawArguments)
    ) {
      return rawArguments as Record<string, unknown>;
    }

    if (typeof rawArguments !== "string") {
      return {};
    }

    try {
      const parsed = JSON.parse(rawArguments);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private isRetryableError(err: any): boolean {
    const statusCode = Number(err?.statusCode ?? err?.status ?? 0);
    return statusCode === 429 || statusCode >= 500;
  }
}
