import { env } from '@/config/env';
import { loggers } from '@/utils/logger';
import OpenAI from 'openai';
import {
  normalizeGatewayHeaders,
  addRuntimeBlock,
  createRuntimeRound,
  buildRuntimeUsageFromOpenAI,
  mapOpenAIFinishReasonToRuntimeStopReason,
} from './runtime-contract';
import type { AIProvider, AIProviderType, CallLLMParams } from './types';
import type { RuntimeRound } from './runtime-contract';

export class CloudflareProvider implements AIProvider {
  private client: OpenAI;
  private accountId: string;
  private gatewayId: string;

  constructor(accountId: string, gatewayId: string, apiToken: string) {
    this.accountId = accountId;
    this.gatewayId = gatewayId;
    this.client = new OpenAI({
      apiKey: apiToken,
      baseURL: `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/compat`,
      timeout: 25000,
      maxRetries: 0,
    });
    loggers.ai.info(`☁️ CloudflareProvider configurado (gateway: ${gatewayId})`);
  }

  getName(): string { return 'Cloudflare AI Gateway'; }
  getType(): AIProviderType { return 'cloudflare'; }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  async callLLM(params: CallLLMParams): Promise<{ round: RuntimeRound; completion: OpenAI.Chat.Completions.ChatCompletion }> {
    const runtimeRound = createRuntimeRound({
      conversationId: 'internal',
      userId: 'internal',
      model: params.model,
      gatewayBaseUrl: `https://gateway.ai.cloudflare.com/v1/${this.accountId}/${this.gatewayId}/compat`,
    });

    try {
      const completionRequest = this.client.chat.completions.create(
        {
          model: params.model,
          messages: params.messages as OpenAI.Chat.ChatCompletionMessageParam[],
          temperature: params.temperature,
          max_tokens: params.maxTokens,
          tools: params.tools as OpenAI.Chat.ChatCompletionTool[] | undefined,
          tool_choice: params.toolChoice as OpenAI.Chat.ChatCompletionToolChoiceOption | undefined,
        },
        { headers: { 'cf-aig-collect-log': 'true' } },
      );

      let completion: OpenAI.Chat.Completions.ChatCompletion;

      if (typeof (completionRequest as any).withResponse === 'function') {
        const responseWithHeaders = await (completionRequest as any).withResponse();
        completion = responseWithHeaders.data;
        const headerEntries = responseWithHeaders.response?.headers
          ? Object.fromEntries(responseWithHeaders.response.headers.entries())
          : undefined;
        runtimeRound.gatewayHeaders = normalizeGatewayHeaders(
          headerEntries as Record<string, string | null | undefined> | undefined,
        );
      } else {
        completion = await completionRequest;
      }

      runtimeRound.stopReason = mapOpenAIFinishReasonToRuntimeStopReason(completion.choices[0]?.finish_reason);
      runtimeRound.usage = buildRuntimeUsageFromOpenAI(completion.usage);

      const assistantMessage = completion.choices[0]?.message;
      if (typeof assistantMessage?.content === 'string' && assistantMessage.content.trim().length > 0) {
        addRuntimeBlock(runtimeRound, { type: 'assistant_text', text: assistantMessage.content });
      }

      for (const toolCall of assistantMessage?.tool_calls ?? []) {
        const funcCall = (toolCall as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall).function;
        addRuntimeBlock(runtimeRound, {
          type: 'tool_use',
          id: toolCall.id,
          name: funcCall.name,
          input: this.safeParse(funcCall.arguments),
        });
      }

      return { round: runtimeRound, completion };
    } catch (error: any) {
      addRuntimeBlock(runtimeRound, {
        type: 'error',
        code: String(error?.statusCode ?? error?.status ?? 'cloudflare_error'),
        message: error?.message ?? 'Cloudflare provider error',
        retryable: Number(error?.statusCode ?? error?.status ?? 0) >= 429,
      });
      throw Object.assign(error instanceof Error ? error : new Error(String(error)), { runtimeRound });
    }
  }

  private safeParse(raw: unknown): Record<string, unknown> {
    if (typeof raw !== 'string') return {};
    try {
      const p = JSON.parse(raw);
      return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
}
