import { CredentialPool } from '../model/credential-pool';
import { getTransport, detectApiMode } from '../model/transports';
import OpenAI from 'openai';

export interface WrappedMemory {
	userId: string;
	schemaVersion: number;
	normalizedContent: string;
	relevanceDecay: { decayClass: string; decayScore: number; reinforcementCount: number };
	confidence: number;
	category: string;
}

export class SemanticWrapperPipeline {
	private credentialPool: CredentialPool;

	constructor(deps?: { credentialPool?: CredentialPool }) {
		this.credentialPool = deps?.credentialPool ?? CredentialPool.fromEnv();
	}

	async wrap(input: {
		userId: string;
		content: string;
		sourceKind: 'intake' | 'observation' | 'derived' | 'job';
	}): Promise<WrappedMemory> {
		let category = 'general';
		let confidence = 1;

		try {
			const resolved = this.credentialPool.resolve('openai');
			if (resolved) {
				const apiMode = detectApiMode(resolved.baseURL);
				const transport = getTransport(apiMode);
				const client = new OpenAI({ apiKey: resolved.apiKey, baseURL: resolved.baseURL });

				const kwargs = transport.buildKwargs({
					model: 'gpt-4o-mini',
					messages: [{ role: 'user', content: input.content.slice(0, 500) }],
					systemPrompt: 'You classify user messages. Respond with JSON: {"category": "work|personal|tech|general", "confidence": 0-1}',
				});

				const raw = await client.chat.completions.create(kwargs as any);
				const normalized = transport.normalizeResponse(raw);
				const parsed = JSON.parse(normalized.content ?? '{}');
				category = parsed.category ?? 'general';
				confidence = parsed.confidence ?? 1;
			}
		} catch {
			// LLM failed — use defaults
		}

		return {
			userId: input.userId,
			schemaVersion: 1,
			normalizedContent: input.content.trim(),
			relevanceDecay: { decayClass: 'contextual', decayScore: 1, reinforcementCount: 0 },
			confidence,
			category,
		};
	}
}
