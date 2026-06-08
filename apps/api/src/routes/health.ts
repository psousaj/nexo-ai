import type { Hono } from 'hono';
import pkg from '../../package.json';

export function registerHealthRoutes(
	app: Hono,
	deps?: {
		shadowReplayService?: any;
		rolloutGateChecker?: any;
		errorStats?: any;
		uptimeHours?: number;
	},
) {
	app.get('/health', (c) => c.json({ status: 'ok' }));
	app.get('/', (c) =>
		c.json({ name: 'Nexo AI Hermes', version: pkg.version, description: 'Hermes Engine - Nexo AI assistive core' }),
	);

	app.get('/health/hermes', async (c) => {
		const shadowReplayStats = deps?.shadowReplayService?.getStats?.() ?? {
			totalRuns: 0,
			avgMatchScore: 0,
			matchRateAbove95: 0,
			avgHermesLatency: 0,
			avgLegacyLatency: 0,
		};
		const errorStats = deps?.errorStats ?? { errorRate: 0 };
		const uptimeHours = deps?.uptimeHours ?? 0;

		let gateResult: { canRollout: boolean; reason?: string } | undefined;
		if (deps?.rolloutGateChecker) {
			gateResult = deps.rolloutGateChecker.check(shadowReplayStats, errorStats, uptimeHours);
		} else {
			gateResult = {
				canRollout: false,
				gates: [],
			};
		}

		return c.json({
			status: gateResult.canRollout ? 'healthy' : 'degraded',
			gates: gateResult.gates,
			shadowReplay: shadowReplayStats,
			timestamp: new Date().toISOString(),
		});
	});
}
