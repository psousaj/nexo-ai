export type CredentialStrategy = 'fill_first' | 'round_robin' | 'random';

interface Credential {
	apiKey: string;
	baseURL: string;
	provider: string;
}

interface PoolEntry {
	credential: Credential;
	status: 'active' | 'exhausted';
	resetAt: number | null;
}

export class CredentialPool {
	private pools = new Map<string, PoolEntry[]>();
	private roundRobinCounters = new Map<string, number>();
	private strategies = new Map<string, CredentialStrategy>();

	register(provider: string, apiKeys: string[], baseURL: string, strategy?: CredentialStrategy): void {
		const entries: PoolEntry[] = apiKeys.map((apiKey) => ({
			credential: { apiKey, baseURL, provider },
			status: 'active',
			resetAt: null,
		}));
		this.pools.set(provider, entries);
		this.roundRobinCounters.set(provider, 0);
		if (strategy) this.strategies.set(provider, strategy);
	}

	resolve(provider: string): { apiKey: string; baseURL: string } | null {
		const pool = this.pools.get(provider);
		if (!pool || pool.length === 0) return null;

		const strategy = this.strategies.get(provider) ?? 'fill_first';
		const now = Date.now();

		const active = pool.filter((e) => {
			if (e.status === 'active') return true;
			if (e.resetAt && now >= e.resetAt) {
				e.status = 'active';
				e.resetAt = null;
				return true;
			}
			return false;
		});

		if (active.length === 0) return null;

		let selected: PoolEntry;

		switch (strategy) {
			case 'round_robin': {
				const counter = (this.roundRobinCounters.get(provider) ?? 0) % active.length;
				selected = active[counter];
				this.roundRobinCounters.set(provider, counter + 1);
				break;
			}
			case 'random':
				selected = active[Math.floor(Math.random() * active.length)];
				break;
			case 'fill_first':
			default:
				selected = active[0];
				break;
		}

		return { apiKey: selected.credential.apiKey, baseURL: selected.credential.baseURL };
	}

	markExhausted(provider: string, apiKey: string, cooldownMs: number = 3600000): void {
		const pool = this.pools.get(provider);
		if (!pool) return;
		const entry = pool.find((e) => e.credential.apiKey === apiKey);
		if (entry) {
			entry.status = 'exhausted';
			entry.resetAt = Date.now() + cooldownMs;
		}
	}

	static fromEnv(): CredentialPool {
		const pool = new CredentialPool();

		if (process.env.OPENAI_API_KEY) {
			pool.register('openai', [process.env.OPENAI_API_KEY], 'https://api.openai.com/v1');
		}
		if (process.env.DEEPSEEK_API_KEY) {
			pool.register('deepseek', [process.env.DEEPSEEK_API_KEY], 'https://api.deepseek.com/v1');
		}
		if (process.env.OPENROUTER_API_KEY) {
			pool.register('openrouter', [process.env.OPENROUTER_API_KEY], 'https://openrouter.ai/api/v1', 'round_robin');
		}

		return pool;
	}
}
