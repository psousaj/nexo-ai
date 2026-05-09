export function applyRelevanceDecay(
	baseScore: number,
	decay: {
		decayClass: 'ephemeral' | 'contextual' | 'durable' | 'critical';
		decayScore: number;
		reinforcementCount: number;
		lastAccessedAt?: string;
	},
) {
	const multiplier = decay.decayClass === 'critical' ? 1 : decay.decayScore;
	return Math.max(0, Math.min(1, baseScore * multiplier));
}
