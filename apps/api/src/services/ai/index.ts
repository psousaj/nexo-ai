import { env } from '@/config/env';
import { buildAgentPrompt } from '@/config/prompt-builder';
import { instrumentService } from '@/services/service-instrumentation';
import { loggers } from '@/utils/logger';
import { setAttributes, startSpan } from '@nexo/otel/tracing';
import { CloudflareProvider } from './cloudflare-provider';
import { DeepSeekProvider } from './deepseek-provider';
import { keyStore } from './key-store';
import { modelRegistryService } from './model-registry';
import { OpenAIProvider } from './openai-provider';
import type { AIProvider, AIProviderType, CallLLMParams } from './types';

export class MultiProviderService {
	private providers = new Map<AIProviderType, AIProvider>();
	private initialized = false;

	constructor() {
		this.initializeProviders();
	}

	private async initializeProviders(): Promise<void> {
		if (this.initialized) return;

		const cfKey = await keyStore.getKey('cloudflare');
		if (cfKey?.key) {
			this.providers.set(
				'cloudflare',
				new CloudflareProvider(
					cfKey.config.accountId || '',
					cfKey.config.gatewayId || 'nexo-ai-gateway',
					cfKey.key,
				),
			);
		}

		const oaKey = await keyStore.getKey('openai');
		if (oaKey?.key) {
			this.providers.set('openai', new OpenAIProvider(oaKey.key));
		}

		const dsKey = await keyStore.getKey('deepseek');
		if (dsKey?.key) {
			this.providers.set('deepseek', new DeepSeekProvider(dsKey.key));
		}

		this.initialized = true;
		loggers.ai.info(`🤖 MultiProviderService inicializado com ${this.providers.size} provider(s) via BYOK`);
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) await this.initializeProviders();
	}

	async callLLM(params: {
		message: string;
		history?: Array<{ role: 'user' | 'assistant'; content: string }>;
		systemPrompt?: string;
		contextType?: 'chat' | 'intent';
	}): Promise<{ message: string; round: import('./runtime-contract').RuntimeRound }> {
		await this.ensureInitialized();
		return this._callLLM(params);
	}

	private async _callLLM(params: {
		message: string;
		history?: Array<{ role: 'user' | 'assistant'; content: string }>;
		systemPrompt?: string;
		contextType?: 'chat' | 'intent';
	}): Promise<{ message: string; round: import('./runtime-contract').RuntimeRound }> {
		return startSpan('llm.call', async () => {
			const systemPrompt = params.systemPrompt || buildAgentPrompt({ assistantName: 'Nexo' }).system;
			const contextType = params.contextType ?? 'chat';

			const messages: CallLLMParams['messages'] = [];
			if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
			for (const msg of params.history ?? []) {
				messages.push({ role: msg.role, content: msg.content });
			}
			messages.push({ role: 'user', content: params.message });

			setAttributes({
				'llm.message_length': params.message.length,
				'llm.history_count': params.history?.length || 0,
				'llm.system_prompt_length': systemPrompt.length,
			});

			const models = await modelRegistryService.getEnabledModels(undefined, contextType);
			if (models.length === 0) {
				throw new Error('No enabled AI models found in registry. Seed the model_registry table.');
			}

			let lastError: Error | null = null;
			let attemptedProviders = 0;

			for (const model of models) {
				const provider = this.providers.get(model.provider as AIProviderType);
				if (!provider) {
					loggers.ai.warn(`Provider ${model.provider} not configured (no API key), skipping model ${model.modelId}`);
					continue;
				}

				attemptedProviders++;
				try {
					setAttributes({ 'llm.provider': model.provider, 'llm.model': model.modelId });

					const { round } = await provider.callLLM({
						model: model.modelId,
						messages,
						responseFormat: contextType === 'intent' ? 'json_object' : 'text',
					});

					const textBlock = round.blocks.find((b) => b.type === 'assistant_text');
					const errorBlock = round.blocks.find((b) => b.type === 'error');

					if (errorBlock && !textBlock) {
						throw new Error(errorBlock.message || 'Provider returned error without text');
					}

					setAttributes({
						'llm.prompt_tokens': round.usage?.inputTokens ?? 0,
						'llm.completion_tokens': round.usage?.outputTokens ?? 0,
						'llm.total_tokens': round.usage?.totalTokens ?? 0,
						'llm.response_length': textBlock?.text?.length ?? 0,
					});

					loggers.ai.info(
						{ provider: model.provider, model: model.modelId, tokens: round.usage?.totalTokens },
						`✅ LLM response via ${model.provider}/${model.modelId}`,
					);

					return { message: textBlock?.text ?? '', round };
				} catch (error: any) {
					lastError = error;
					setAttributes({ 'llm.provider_failed': model.provider, 'llm.model_failed': model.modelId });
					loggers.ai.warn(
						`⚠️ Provider ${model.provider}/${model.modelId} failed: ${error.message}. Trying next...`,
					);
					continue;
				}
			}

			if (lastError) {
				throw lastError;
			}
			const enabledProviderKeys = this.getEnabledProviders();
			throw new Error(
				enabledProviderKeys.length === 0
					? 'No AI providers configured. Set API keys via Admin > AI Providers (BYOK).'
					: `No AI models from configured providers (${enabledProviderKeys.join(', ')}) matched the requested context type "${contextType}". Check the model_registry table.`,
			);
		});
	}

	async getCurrentProvider(): Promise<string> {
		if (this.providers.size === 0) return 'none';
		const models = await modelRegistryService.getEnabledModels();
		if (models.length === 0) return 'none-enabled';
		return models[0].provider;
	}

	getEnabledProviders(): AIProviderType[] {
		return Array.from(this.providers.keys());
	}

	getProvider(type: AIProviderType): AIProvider | undefined {
		return this.providers.get(type);
	}
}

export const llmService = instrumentService('llm', new MultiProviderService());

// Barrel re-exports — keep existing exports that are still valid
export type { AIProvider, CallLLMParams, AIProviderType, ModelContextType, ModelRegistryEntry } from './types';

export {
	buildManualLoopTools,
	runOpenAIManualLoop,
	type OpenAIManualLoopDependencies,
	type OpenAIManualLoopRequest,
	type OpenAIManualLoopResult,
} from './openai-manual-loop';

export {
	buildRuntimeContext,
	type RuntimeContextBuilderRequest,
	type RuntimeContextBuilderResult,
	type RuntimeHistoryBlock,
} from './runtime-context-builder';

export {
	executeIntentClassificationTask,
	type IntentClassificationPhase,
	type IntentClassificationTaskRequest,
	type IntentClassificationTaskResult,
} from './intent-classification-task';

export {
	executeEmbeddingTask,
	type EmbeddingTaskRequest,
	type EmbeddingTaskResult,
} from './embedding-task';

export {
	buildRuntimeObservabilityAttributes,
	summarizeRuntimeRounds,
	type RuntimeRoundsSummary,
} from './runtime-observability';

export type {
	RuntimeErrorBlock,
	RuntimeGatewayHeaders,
	RuntimeInternalTaskBlock,
	RuntimeInternalTaskName,
	RuntimeInternalTaskStatus,
	RuntimeRound,
	RuntimeRoundBlock,
	RuntimeRoundContext,
	RuntimeStopReason,
	RuntimeToolResultBlock,
	RuntimeToolUseBlock,
	RuntimeUsage,
	RuntimeAssistantTextBlock,
} from './runtime-contract';
