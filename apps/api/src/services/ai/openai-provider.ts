import { env } from '@/config/env';
import { loggers } from '@/utils/logger';
import OpenAI from 'openai';
import {
  addRuntimeBlock,
  buildRuntimeUsageFromOpenAI,
  createRuntimeRound,
  mapOpenAIFinishReasonToRuntimeStopReason,
} from './runtime-contract';
import type { AIProvider, AIProviderType, CallLLMParams } from './types';
import type { RuntimeRound } from './runtime-contract';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, timeout: 25000, maxRetries: 0 });
    loggers.ai.info('🧠 OpenAIProvider configurado');
  }

  getName(): string { return 'OpenAI'; }
  getType(): AIProviderType { return 'openai'; }

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
      gatewayBaseUrl: 'https://api.openai.com/v1',
    });

    try {
      const completion = await this.client.chat.completions.create({
        model: params.model,
        messages: params.messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        tools: params.tools as OpenAI.Chat.ChatCompletionTool[] | undefined,
        tool_choice: params.toolChoice as OpenAI.Chat.ChatCompletionToolChoiceOption | undefined,
        response_format: params.responseFormat === 'json_object'
          ? { type: 'json_object' as const }
          : undefined,
      });

      runtimeRound.stopReason = mapOpenAIFinishReasonToRuntimeStopReason(completion.choices[0]?.finish_reason);
      runtimeRound.usage = buildRuntimeUsageFromOpenAI(completion.usage);

      const msg = completion.choices[0]?.message;
      if (typeof msg?.content === 'string' && msg.content.trim().length > 0) {
        addRuntimeBlock(runtimeRound, { type: 'assistant_text', text: msg.content });
      }

      for (const toolCall of msg?.tool_calls ?? []) {
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
        code: String(error?.statusCode ?? error?.status ?? 'openai_error'),
        message: error?.message ?? 'OpenAI provider error',
        retryable: Number(error?.statusCode ?? error?.status ?? 0) >= 429,
      });
      throw Object.assign(error instanceof Error ? error : new Error(String(error)), { runtimeRound });
    }
  }

  private safeParse(raw: unknown): Record<string, unknown> {
    if (typeof raw !== 'string') return {};
    try { const p = JSON.parse(raw); return p && typeof p === 'object' && !Array.isArray(p) ? p as Record<string, unknown> : {}; } catch { return {}; }
  }
}
