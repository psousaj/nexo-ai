import OpenAI from 'openai';
import type { ModelTurnOutput, ModelTurnRunner } from '../kernel/model-turn-runner';
import { CredentialPool } from './credential-pool';
import { getTransport, detectApiMode } from './transports';
import type { NormalizedResponse } from './transports/types';

export class DefaultModelTurnRunner implements ModelTurnRunner {
	private credentialPool: CredentialPool;

	constructor(
		private deps: {
			credentialPool?: CredentialPool;
			defaultProvider?: string;
			defaultModel?: string;
		} = {},
	) {
		this.credentialPool = deps.credentialPool ?? CredentialPool.fromEnv();
	}

	async next(context: unknown): Promise<ModelTurnOutput> {
		const ctx = context as { systemPrompt: string; sessionKey: string };
		const provider = this.deps.defaultProvider ?? 'openai';
		const model = this.deps.defaultModel ?? 'gpt-4o-mini';

		const resolved = this.credentialPool.resolve(provider);
		if (!resolved) {
			return { type: 'respond', text: 'Nenhum provedor de IA configurado. Configure OPENAI_API_KEY no .env' };
		}

		const apiMode = detectApiMode(resolved.baseURL);
		const transport = getTransport(apiMode);

		try {
			const client = new OpenAI({
				apiKey: resolved.apiKey,
				baseURL: resolved.baseURL,
			});

			const kwargs = transport.buildKwargs({
				model,
				messages: [],
				systemPrompt: ctx.systemPrompt,
			});

			const rawResponse = await client.chat.completions.create(kwargs as any);
			const normalized = transport.normalizeResponse(rawResponse);

			return this.toModelTurnOutput(normalized);
		} catch (error: any) {
			if (error?.status === 429 || error?.status === 402) {
				this.credentialPool.markExhausted(provider, resolved.apiKey);
				return { type: 'respond', text: 'O serviço de IA está sobrecarregado. Tente novamente em alguns instantes.' };
			}

			return { type: 'respond', text: 'Desculpe, não consegui processar sua mensagem agora.' };
		}
	}

	private toModelTurnOutput(normalized: NormalizedResponse): ModelTurnOutput {
		if (normalized.toolCalls && normalized.toolCalls.length > 0) {
			const tc = normalized.toolCalls[0];
			return { type: 'tool', toolName: tc.name, input: tc.arguments };
		}
		return { type: 'respond', text: normalized.content ?? 'Entendi.' };
	}
}
