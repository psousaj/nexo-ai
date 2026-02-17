import { db } from '@/db';
import { users } from '@/db/schema';
import { accounts as betterAuthAccounts } from '@/db/schema/auth';
import { eq, sql } from 'drizzle-orm';
import { loggers } from '@/utils/logger';

export const TRIAL_LIMIT = 10;

/**
 * Middleware de Onboarding e Trial
 * Verifica se o usuário pode continuar interagindo ou se precisa de cadastro
 */
export async function checkOnboardingStatus(
	userId: string,
	provider: string,
): Promise<{
	allowed: boolean;
	reason?: 'trial_exceeded' | 'signup_required';
	interactionCount: number;
}> {
	const [user] = await db
		.select({
			status: users.status,
			interactionCount: users.interactionCount,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		return { allowed: false, reason: 'signup_required', interactionCount: 0 };
	}

	// 1. Usuário já ativo pode tudo
	if (user.status === 'active') {
		return { allowed: true, interactionCount: user.interactionCount };
	}

	// 2. Verifica se o user tem conta Better Auth (fez signup no dashboard)
	//    Se sim, auto-ativa e permite
	const [betterAuthAccount] = await db
		.select({ id: betterAuthAccounts.id })
		.from(betterAuthAccounts)
		.where(eq(betterAuthAccounts.userId, userId))
		.limit(1);

	if (betterAuthAccount) {
		loggers.app.info({ userId }, '🔓 Auto-ativando usuário com conta Better Auth vinculada');
		await db
			.update(users)
			.set({ status: 'active', updatedAt: new Date() })
			.where(eq(users.id, userId));
		return { allowed: true, interactionCount: user.interactionCount };
	}

	// 3. WhatsApp tem TRIAL de 10 mensagens
	if (provider === 'whatsapp') {
		if (user.interactionCount < TRIAL_LIMIT) {
			return { allowed: true, interactionCount: user.interactionCount };
		}
		return { allowed: false, reason: 'trial_exceeded', interactionCount: user.interactionCount };
	}

	// 4. Telegram: trial de TRIAL_LIMIT mensagens (mesmo que WhatsApp)
	if (provider === 'telegram') {
		if (user.interactionCount < TRIAL_LIMIT) {
			return { allowed: true, interactionCount: user.interactionCount };
		}
		return { allowed: false, reason: 'trial_exceeded', interactionCount: user.interactionCount };
	}

	// 5. Outros providers exigem cadastro (status active)
	if (user.status === 'pending_signup' || user.status === 'trial') {
		return { allowed: false, reason: 'signup_required', interactionCount: user.interactionCount };
	}

	return { allowed: true, interactionCount: user.interactionCount };
}

/**
 * Incrementa o contador de interações do usuário
 */
async function incrementInteractionCount(userId: string) {
	await db
		.update(users)
		.set({
			interactionCount: sql`${users.interactionCount} + 1`,
			updatedAt: new Date(),
		})
		.where(eq(users.id, userId));
}

const onboardingService = {
	checkOnboardingStatus,
	incrementInteractionCount,
};

export { onboardingService };
