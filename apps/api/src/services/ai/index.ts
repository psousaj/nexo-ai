import { buildAgentPrompt } from '@/config/prompt-builder';
import { instrumentService } from '@/services/service-instrumentation';
import { loggers } from '@/utils/logger';
import { setAttributes, startSpan } from '@nexo/otel/tracing';
import { CloudflareProvider } from './cloudflare-provider';
import { CustomProvider } from './custom-provider';
import { DeepSeekProvider } from './deepseek-provider';
import { keyStore } from './key-store';
import { modelRegistryService } from './model-registry';
import { OpenAIProvider } from './openai-provider';
import { providerRegistryService } from './provider-registry';
import { createRuntimeRound } from './runtime-contract';
import type { AIProvider, AIProviderType, CallLLMParams, ProviderEntry } from './types';

export class MultiProviderService {
	private providerInstances = new Map<string, AIProvider>();
	private providerEntries = new Map<number, ProviderEntry>();
	private initialized = false;

	constructor() {
		this.initializeProviders().catch((err) => {
			loggers.ai.warn(
				err,
				'⚠️ MultiProviderService: falha na inicialização eager dos providers. Será re-tentada na primeira chamada.',
			);
		});
	}

	async reload(): Promise<void> {
		this.initialized = false;
		this.providerInstances.clear();
		this.providerEntries.clear();
		await this.initializeProviders();
	}

	private async initializeProviders(): Promise<void> {
		if (this.initialized) return;

		await providerRegistryService.seedDefaults();
		const entries = await providerRegistryService.getEnabled();

		for (const entry of entries) {
			const keyData = await keyStore.getKey(String(entry.id));
			const key = keyData?.key;
			if (!key) continue;

			const provider = this.createProviderInstance(entry.type, key, entry.label, keyData?.config ?? {});
			if (provider) {
				const instanceKey = `${entry.type}:${entry.id}`;
				this.providerInstances.set(instanceKey, provider);
				this.providerEntries.set(entry.id, entry);
			}
		}

		this.initialized = true;
		loggers.ai.info(`🤖 MultiProviderService inicializado com ${this.providerInstances.size} provider(s) via BYOK`);
	}

	private createProviderInstance(
		type: AIProviderType,
		apiKey: string,
		label: string,
		config: Record<string, string>,
	): AIProvider | null {
		try {
			switch (type) {
				case 'cloudflare':
					return new CloudflareProvider(config.accountId || '', config.gatewayId || 'nexo-ai-gateway', apiKey);
				case 'openai':
					return new OpenAIProvider(apiKey);
				case 'deepseek':
					return new DeepSeekProvider(apiKey);
				case 'custom':
					return new CustomProvider(apiKey, config.baseUrl || config.apiBase || '', label);
				default:
					return null;
			}
		} catch (err) {
			loggers.ai.warn(err, `Failed to create provider instance for ${type}:${label}`);
			return null;
		}
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
				loggers.ai.warn('⚠️ No enabled AI models found in registry. Seed the model_registry table.');
				return {
					message: 'Desculpe, não consigo processar isso agora.',
					round: createRuntimeRound({ conversationId: '', userId: '', model: 'none', gatewayBaseUrl: '' }),
				};
			}

			let lastError: Error | null = null;

			for (const model of models) {
				const providerType = model.provider as AIProviderType;
				const provider = this.findProviderByType(providerType);
				if (!provider) {
					loggers.ai.warn(`Provider ${providerType} not configured (no API key), skipping model ${model.modelId}`);
					continue;
				}

				try {
					setAttributes({ 'llm.provider': providerType, 'llm.model': model.modelId });

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
						{ provider: providerType, model: model.modelId, tokens: round.usage?.totalTokens },
						`✅ LLM response via ${providerType}/${model.modelId}`,
					);

					return { message: textBlock?.text ?? '', round };
				} catch (error: any) {
					lastError = error;
					setAttributes({ 'llm.provider_failed': providerType, 'llm.model_failed': model.modelId });
					loggers.ai.warn(`⚠️ Provider ${providerType}/${model.modelId} failed: ${error.message}. Trying next...`);
				}
			}

			if (lastError) {
				throw lastError;
			}
			const enabledTypes = this.getEnabledProviderTypes();
			if (enabledTypes.length === 0) {
				loggers.ai.warn('⚠️ No AI providers configured. Set API keys via Admin > AI Providers (BYOK).');
			} else {
				loggers.ai.warn(
					`No AI models from configured providers (${enabledTypes.join(', ')}) matched the requested context type "${contextType}". Check the model_registry table.`,
				);
			}
			return {
				message: 'Desculpe, não consigo processar isso agora.',
				round: createRuntimeRound({ conversationId: '', userId: '', model: 'none', gatewayBaseUrl: '' }),
			};
		});
	}

	async getCurrentProvider(): Promise<string> {
		if (this.providerInstances.size === 0) return 'none';
		const models = await modelRegistryService.getEnabledModels();
		if (models.length === 0) return 'none-enabled';
		return models[0].provider;
	}

	getEnabledProviders(): AIProviderType[] {
		const types = new Set<AIProviderType>();
		for (const entry of this.providerEntries.values()) {
			types.add(entry.type);
		}
		return Array.from(types);
	}

	getEnabledProviderTypes(): string[] {
		return this.getEnabledProviders();
	}

	private findProviderByType(type: AIProviderType): AIProvider | undefined {
		for (const [key, provider] of this.providerInstances) {
			if (key.startsWith(`${type}:`)) return provider;
		}
		return undefined;
	}

	getProvider(type: AIProviderType): AIProvider | undefined {
		return this.findProviderByType(type);
	}

	getProviderEntries(): ProviderEntry[] {
		return Array.from(this.providerEntries.values());
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
