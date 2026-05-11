import { describe, expect, it } from 'vitest';
import { RolloutGateChecker } from '@/core/validation/rollout-gates';

describe('RolloutGateChecker', () => {
	const config = {
		minMatchRate: 0.95,
		maxLatencyP95Ms: 5000,
		maxErrorRate: 0.01,
		minStableHours: 24,
	};

	it('should pass all gates and allow rollout', () => {
		const checker = new RolloutGateChecker(config);
		const shadowReplayStats = {
			matchRateAbove95: 98,
			avgHermesLatency: 2000,
		};
		const errorStats = { errorRate: 0.005 };
		const uptimeHours = 48;

		const result = checker.check(shadowReplayStats, errorStats, uptimeHours);

		expect(result.canRollout).toBe(true);
		expect(result.gates.every((g) => g.passed)).toBe(true);
	});

	it('should fail when match rate is below threshold', () => {
		const checker = new RolloutGateChecker(config);
		const shadowReplayStats = {
			matchRateAbove95: 90,
			avgHermesLatency: 2000,
		};
		const errorStats = { errorRate: 0.005 };
		const uptimeHours = 48;

		const result = checker.check(shadowReplayStats, errorStats, uptimeHours);

		expect(result.canRollout).toBe(false);
		const matchGate = result.gates.find((g) => g.name === 'shadow_replay_match_rate');
		expect(matchGate!.passed).toBe(false);
	});

	it('should fail when latency exceeds threshold', () => {
		const checker = new RolloutGateChecker(config);
		const shadowReplayStats = {
			matchRateAbove95: 98,
			avgHermesLatency: 6000,
		};
		const errorStats = { errorRate: 0.005 };
		const uptimeHours = 48;

		const result = checker.check(shadowReplayStats, errorStats, uptimeHours);

		expect(result.canRollout).toBe(false);
		const latencyGate = result.gates.find((g) => g.name === 'latency_p95');
		expect(latencyGate!.passed).toBe(false);
	});

	it('should fail when error rate exceeds threshold', () => {
		const checker = new RolloutGateChecker(config);
		const shadowReplayStats = {
			matchRateAbove95: 98,
			avgHermesLatency: 2000,
		};
		const errorStats = { errorRate: 0.02 };
		const uptimeHours = 48;

		const result = checker.check(shadowReplayStats, errorStats, uptimeHours);

		expect(result.canRollout).toBe(false);
		const errorGate = result.gates.find((g) => g.name === 'error_rate');
		expect(errorGate!.passed).toBe(false);
	});

	it('should fail when uptime is below threshold', () => {
		const checker = new RolloutGateChecker(config);
		const shadowReplayStats = {
			matchRateAbove95: 98,
			avgHermesLatency: 2000,
		};
		const errorStats = { errorRate: 0.005 };
		const uptimeHours = 12;

		const result = checker.check(shadowReplayStats, errorStats, uptimeHours);

		expect(result.canRollout).toBe(false);
		const stabilityGate = result.gates.find((g) => g.name === 'stability');
		expect(stabilityGate!.passed).toBe(false);
	});

	it('should include gate messages', () => {
		const checker = new RolloutGateChecker(config);
		const shadowReplayStats = {
			matchRateAbove95: 96.5,
			avgHermesLatency: 3000,
		};
		const errorStats = { errorRate: 0.008 };
		const uptimeHours = 30;

		const result = checker.check(shadowReplayStats, errorStats, uptimeHours);

		expect(result.gates[0].message).toContain('96.5%');
		expect(result.gates[1].message).toContain('3000ms');
		expect(result.gates[2].message).toContain('0.80%');
		expect(result.gates[3].message).toContain('30.0h');
	});
});
