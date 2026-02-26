export class Semaphore {
	private current = 0;
	private readonly waitQueue: Array<() => void> = [];

	constructor(private readonly maxConcurrency: number) {
		if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
			throw new Error(`maxConcurrency inválido: ${maxConcurrency}`);
		}
	}

	private async acquire(): Promise<void> {
		if (this.current < this.maxConcurrency) {
			this.current += 1;
			return;
		}

		await new Promise<void>((resolve) => {
			this.waitQueue.push(resolve);
		});

		this.current += 1;
	}

	private release(): void {
		this.current = Math.max(0, this.current - 1);

		const next = this.waitQueue.shift();
		if (next) {
			next();
		}
	}

	async use<T>(task: () => Promise<T>): Promise<T> {
		await this.acquire();

		try {
			return await task();
		} finally {
			this.release();
		}
	}
}

export async function mapWithConcurrency<T, R>(
	items: T[],
	maxConcurrency: number,
	mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const semaphore = new Semaphore(maxConcurrency);
	const results: R[] = new Array(items.length);

	await Promise.all(
		items.map((item, index) =>
			semaphore.use(async () => {
				results[index] = await mapper(item, index);
			}),
		),
	);

	return results;
}
