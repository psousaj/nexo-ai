import crypto from 'node:crypto';
import { captureException } from '@/sentry';
import { loggers } from '@/utils/logger';

export interface ErrorContext {
	userId?: string;
	conversationId?: string;
	provider?: string;
	state?: string;
	intent?: string;
	extra?: Record<string, any>;
}

export class GlobalErrorService {
	/**
	 * Captura erro e envia para Sentry
	 */
	async handle(error: Error | any, context: ErrorContext) {
		try {
			// 1. Anonimiza ID de sessão
			const sessionId = context.userId ? this.hashUserId(context.userId) : undefined;

			// 2. Serializa erro
			const errorType = error?.name || 'UnknownError';
			const errorMessage = error?.message || String(error);

			// 3. Envia para Sentry
			captureException(error instanceof Error ? error : new Error(errorMessage), {
				conversation_id: context.conversationId,
				user_id: sessionId, // já é hash anônimo
				provider: context.provider,
				state: context.state,
				intent: context.intent,
				...context.extra,
			});

			// 4. Log oficial (substitui console.error)
			loggers.app.error(
				{
					err: error,
					sessionId,
					errorType,
					conversationId: context.conversationId,
				},
				'🔥 Global Error Captured',
			);
		} catch (criticalError) {
			// Failsafe para erro no próprio error handler
			// Aqui usamos console.error pois o logger pode ter falhado (último recurso)
			console.error('CRITICAL: Error passing global handler', criticalError);
		}
	}

	/**
	 * Hash irreversível do ID do usuário para correlação anônima
	 */
	private hashUserId(userId: string): string {
		return crypto
			.createHash('sha256')
			.update(userId + (process.env.SimpleHASH_SALT || 'salt'))
			.digest('hex')
			.substring(0, 16);
	}
}

export const globalErrorHandler = new GlobalErrorService();
