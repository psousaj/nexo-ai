export interface ReplayComparisonResult {
	legacy: unknown;
	hermes: unknown;
}

export class ShadowReplayRunner {
	constructor(private deps: { legacy: { process: (input: unknown) => Promise<unknown> }; hermes: { process: (input: unknown) => Promise<unknown> } }) {}

	async compare(input: unknown): Promise<ReplayComparisonResult> {
		const [legacy, hermes] = await Promise.all([this.deps.legacy.process(input), this.deps.hermes.process(input)]);
		return { legacy, hermes };
	}
}
