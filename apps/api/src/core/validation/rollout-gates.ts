export interface RolloutGateConfig {
	minMatchRate: number; // e.g., 0.95
	maxLatencyP95Ms: number; // e.g., 5000
	maxErrorRate: number; // e.g., 0.01
	minStableHours: number; // e.g., 24
}

export interface RolloutGateResult {
	canRollout: boolean;
	gates: Array<{
		name: string;
		passed: boolean;
		value: number;
		threshold: number;
		message: string;
	}>;
}

export class RolloutGateChecker {
	constructor(private config: RolloutGateConfig) {}

	check(shadowReplayStats: any, errorStats: any, uptimeHours: number): RolloutGateResult {
		const gates = [
			{
				name: 'shadow_replay_match_rate',
				passed: shadowReplayStats.matchRateAbove95 >= this.config.minMatchRate * 100,
				value: shadowReplayStats.matchRateAbove95,
				threshold: this.config.minMatchRate * 100,
				message: `Shadow replay match rate: ${shadowReplayStats.matchRateAbove95.toFixed(1)}% (threshold: ${this.config.minMatchRate * 100}%)`,
			},
			{
				name: 'latency_p95',
				passed: shadowReplayStats.avgHermesLatency <= this.config.maxLatencyP95Ms,
				value: shadowReplayStats.avgHermesLatency,
				threshold: this.config.maxLatencyP95Ms,
				message: `Avg Hermes latency: ${shadowReplayStats.avgHermesLatency.toFixed(0)}ms (threshold: ${this.config.maxLatencyP95Ms}ms)`,
			},
			{
				name: 'error_rate',
				passed: errorStats.errorRate <= this.config.maxErrorRate,
				value: errorStats.errorRate,
				threshold: this.config.maxErrorRate,
				message: `Error rate: ${(errorStats.errorRate * 100).toFixed(2)}% (threshold: ${(this.config.maxErrorRate * 100).toFixed(2)}%)`,
			},
			{
				name: 'stability',
				passed: uptimeHours >= this.config.minStableHours,
				value: uptimeHours,
				threshold: this.config.minStableHours,
				message: `Uptime: ${uptimeHours.toFixed(1)}h (threshold: ${this.config.minStableHours}h)`,
			},
		];

		return {
			canRollout: gates.every((g) => g.passed),
			gates,
		};
	}
}
