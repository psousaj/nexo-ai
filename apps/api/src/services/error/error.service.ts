import crypto from 'node:crypto';
import { db } from '@/db';
import { errorReports, messages } from '@/db/schema';
import { loggers } from '@/utils/logger';
import { desc, eq } from 'drizzle-orm';

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
	 * Captura erro, busca contexto, anonimiza e persiste
	 */
	async handle(error: Error | any, context: ErrorContext) {
		try {
			// 1. Anonimiza ID de sessão
			const sessionId = context.userId ? this.hashUserId(context.userId) : undefined;

			// 2. Busca histórico da conversa (se houver conversationId)
			let conversationHistory: any[] = [];
			if (context.conversationId) {
				const rawHistory = await this.fetchConversationHistory(context.conversationId);
				conversationHistory = this.anonymizeHistory(rawHistory);
			}

			// 3. Serializa erro
			const errorType = error?.name || 'UnknownError';
			const errorMessage = error?.message || String(error);
			const errorStack = error?.stack || undefined;

			// 4. Persiste no DB
			await db.insert(errorReports).values({
				errorType,
				errorMessage,
				errorStack,
				conversationHistory,
				metadata: {
					provider: context.provider,
					state: context.state,
					lastIntent: context.intent,
					...context.extra,
				},
				sessionId,
			});

			// 5. Log oficial (substitui console.error)
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
	 * Busca todo o histórico da conversa para contexto
	 */
	private async fetchConversationHistory(conversationId: string) {
		try {
			return await db
				.select()
				.from(messages)
				.where(eq(messages.conversationId, conversationId))
				.orderBy(desc(messages.createdAt));
		} catch (err) {
			loggers.db.error({ err }, 'Failed to fetch conversation history for error reporting');
			return [];
		}
	}

	/**
	 * Anonimiza dados sensíveis (PII)
	 * Mantém estrutura da mensagem mas remove identificadores
	 */
	private anonymizeHistory(history: any[]): any[] {
		return history.map((msg) => {
			let content = msg.content;

			// Remove telefones/CPFs (basic regex)
			content = content.replace(/\b\d{10,11}\b/g, '[PHONE/CPF REDACTED]');
			content = content.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF REDACTED]');

			// Remove emails
			content = content.replace(/\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b/g, '[EMAIL REDACTED]');

			return {
				role: msg.role,
				content, // Conteúdo sanitizado
				createdAt: msg.createdAt,
				// Não incluímos ID da mensagem nem metadados sensíveis
			};
		});
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
