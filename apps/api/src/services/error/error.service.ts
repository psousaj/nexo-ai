import crypto from 'node:crypto';
import { captureException } from '@/sentry';
import { sentryLogger } from '@/sentry';
import { instrumentService } from '@/services/service-instrumentation';
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
	private toError(error: unknown): Error {
		if (error instanceof Error) return error;
		if (typeof error === 'string') return new Error(error);
		return new Error(JSON.stringify(error));
	}

	private extractErrorExtra(error: unknown): Record<string, any> {
		const err = error as any;
		const message = String(err?.message || '');
		const drizzleMatch = message.match(/Failed query:\s*([\s\S]*?)\nparams:\s*([\s\S]*)$/);
		return {
			errorName: err?.name,
			errorMessage: err?.message,
			stack: err?.stack,
			cause: err?.cause ? String(err.cause) : undefined,
			code: err?.code,
			detail: err?.detail,
			hint: err?.hint,
			constraint: err?.constraint,
			dbQuery: drizzleMatch?.[1]?.trim(),
			dbParams: drizzleMatch?.[2]?.trim(),
		};
	}

	/**
	 * Captura erro e envia para Sentry
	 */
	async handle(error: Error | any, context: ErrorContext) {
		try {
			const normalizedError = this.toError(error);
			const errorExtra = this.extractErrorExtra(error);

			// 1. Anonimiza ID de sessão
			const sessionId = context.userId ? this.hashUserId(context.userId) : undefined;

			// 2. Serializa erro
			const errorType = normalizedError.name || 'UnknownError';
			const errorMessage = normalizedError.message || String(error);

			// 3. Envia para Sentry
			captureException(normalizedError, {
				conversation_id: context.conversationId,
				user_id: sessionId, // já é hash anônimo
				provider: context.provider,
				state: context.state,
				intent: context.intent,
				error_type: errorType,
				error_message: errorMessage,
				...errorExtra,
				...context.extra,
			});

			sentryLogger.error('Global Error Captured', normalizedError, {
				conversationId: context.conversationId,
				provider: context.provider,
				state: context.state,
				intent: context.intent,
				sessionId,
				...context.extra,
			});

			// 4. Log oficial (substitui console.error)
			loggers.app.error(
				{
					err: normalizedError,
					sessionId,
					errorType,
					errorMessage,
					conversationId: context.conversationId,
					provider: context.provider,
					state: context.state,
					extra: context.extra,
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

export const globalErrorHandler = instrumentService('globalErrorHandler', new GlobalErrorService());
